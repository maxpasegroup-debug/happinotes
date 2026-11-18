import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env';

const execFileAsync = promisify(execFile);
const addressPattern = /^[0-9a-fA-F:.]{3,64}$/;

export type PacketMetadata = {
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  sourcePort: number | null;
  destinationPort: number | null;
  sizeBytes: number | null;
};

export type PacketTelemetrySnapshot = {
  enabled: boolean;
  available: boolean;
  capturedAt: string;
  interface: string;
  durationSeconds: number;
  packets: PacketMetadata[];
  reason?: 'disabled' | 'capture_tools_unavailable' | 'capture_failed' | 'decoder_failed';
};

function cleanAddress(value: string | undefined): string {
  return value && addressPattern.test(value) ? value : '';
}

function numberOrNull(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function protocolName(value: string | undefined): string {
  switch (value) {
    case '1': return 'ICMP';
    case '6': return 'TCP';
    case '17': return 'UDP';
    default: return value && /^[A-Za-z0-9_-]{1,16}$/.test(value) ? value : 'Other';
  }
}

/** Parse only the allow-listed TShark fields. Payload bytes and packet data are never read. */
export function parseTsharkFields(output: string): PacketMetadata[] {
  return output.split(/\r?\n/).flatMap(line => {
    if (!line.trim()) return [];
    const [epoch, source, sourceV6, destination, destinationV6, protocol, tcpSource, tcpDestination, udpSource, udpDestination, size] = line.split('\t');
    const timestampNumber = Number(epoch);
    const timestamp = Number.isFinite(timestampNumber) ? new Date(timestampNumber * 1000).toISOString() : '';
    if (!timestamp) return [];
    return [{
      timestamp,
      sourceIp: cleanAddress(source) || cleanAddress(sourceV6),
      destinationIp: cleanAddress(destination) || cleanAddress(destinationV6),
      protocol: protocolName(protocol),
      sourcePort: numberOrNull(tcpSource) ?? numberOrNull(udpSource),
      destinationPort: numberOrNull(tcpDestination) ?? numberOrNull(udpDestination),
      sizeBytes: numberOrNull(size),
    }];
  });
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ['--version'], { timeout: 2_000, maxBuffer: 32_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture a short, bounded metadata-only sample. The capture is temporary and
 * removed before the request completes. This endpoint is admin-only at the
 * route layer and must be explicitly enabled with PACKET_TELEMETRY_ENABLED.
 */
export async function collectPacketTelemetry(): Promise<PacketTelemetrySnapshot> {
  const capturedAt = new Date().toISOString();
  const base = { enabled: env.PACKET_TELEMETRY_ENABLED, capturedAt, interface: env.PACKET_CAPTURE_INTERFACE, durationSeconds: env.PACKET_CAPTURE_DURATION_SECONDS, packets: [] as PacketMetadata[] };
  if (!env.PACKET_TELEMETRY_ENABLED) return { ...base, available: false, reason: 'disabled' };
  if (!(await commandAvailable('dumpcap')) || !(await commandAvailable('tshark'))) return { ...base, available: false, reason: 'capture_tools_unavailable' };

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'happinotes-packet-'));
  const captureFile = path.join(temporaryDirectory, 'sample.pcapng');
  try {
    try {
      await execFileAsync('dumpcap', ['-q', '-i', env.PACKET_CAPTURE_INTERFACE, '-a', `duration:${env.PACKET_CAPTURE_DURATION_SECONDS}`, '-c', String(env.PACKET_CAPTURE_MAX_PACKETS), '-s', String(env.PACKET_CAPTURE_SNAPLEN), '-w', captureFile], { timeout: (env.PACKET_CAPTURE_DURATION_SECONDS + 5) * 1_000, maxBuffer: 64_000 });
    } catch {
      return { ...base, available: false, reason: 'capture_failed' };
    }
    try {
      const fields = ['frame.time_epoch', 'ip.src', 'ipv6.src', 'ip.dst', 'ipv6.dst', 'ip.proto', 'tcp.srcport', 'tcp.dstport', 'udp.srcport', 'udp.dstport', 'frame.len'];
      const args = ['-n', '-r', captureFile, '-T', 'fields', ...fields.flatMap(field => ['-e', field]), '-E', 'separator=\t', '-E', 'quote=n', '-E', 'header=n', '-E', 'occurrence=f'];
      const result = await execFileAsync('tshark', args, { timeout: 5_000, maxBuffer: 1_000_000 });
      return { ...base, available: true, packets: parseTsharkFields(result.stdout).slice(0, env.PACKET_CAPTURE_MAX_PACKETS) };
    } catch {
      return { ...base, available: false, reason: 'decoder_failed' };
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
