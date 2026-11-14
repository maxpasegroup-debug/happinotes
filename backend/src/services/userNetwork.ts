import { isIP } from 'net';
import { BadRequestError } from '../utils/errors';

export const clean = (value: unknown, max = 100): string => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max) : '';
export function normalizeIp(value: unknown): string | undefined {
  const input = clean(value, 80).replace(/^::ffff:/, '');
  return isIP(input) ? input : undefined;
}
export function publicAddress(value: unknown): string | undefined {
  const ip = normalizeIp(value);
  if (!ip) return undefined;
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return undefined;
  } else if (ip === '::' || ip === '::1' || /^(fc|fd|fe[89ab])/i.test(ip)) return undefined;
  return ip;
}
export function parseNetwork(body: Record<string, unknown>) {
  const networkType = clean(body.networkType, 20).toLowerCase();
  if (!['wifi', 'cellular', 'ethernet', 'vpn', 'none', 'unknown'].includes(networkType)) throw new BadRequestError('Invalid network type.');
  return { networkType, deviceIp: normalizeIp(body.deviceIp) || '', carrier: clean(body.carrier, 80), deviceModel: clean(body.deviceModel), os: clean(body.os, 30), osVersion: clean(body.osVersion, 40) };
}

// Explicit location opt-in is separate from basic network reporting. Keep only
// the latest foreground fix; client-reported coordinates are not trusted proof.
export function parseDeviceLocation(value: unknown, now = new Date()) {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object' || Array.isArray(value)) throw new BadRequestError('Invalid device location.');
  const input = value as Record<string, unknown>;
  const { latitude, longitude, accuracy, capturedAt, mocked, consentVersion } = input;
  const timestamp = typeof capturedAt === 'string' ? Date.parse(capturedAt) : NaN;
  if (consentVersion !== 1 || typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
    (accuracy !== null && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)) ||
    !Number.isFinite(timestamp) || timestamp < now.getTime() - 15 * 60 * 1000 || timestamp > now.getTime() + 5 * 60 * 1000 ||
    (mocked !== undefined && typeof mocked !== 'boolean')) throw new BadRequestError('Invalid or expired device location.');
  return { latitude, longitude, accuracy, capturedAt: new Date(timestamp), receivedAt: now, consentVersion: 1,
    ...(typeof mocked === 'boolean' ? { mocked } : {}) };
}

// No IP is sent to a third party unless the operator explicitly configures it.
// The fixed HTTPS host prevents a client-provided lookup target or SSRF.
export async function lookupNetwork(ip: string | undefined) {
  const checkedAt = new Date();
  if (!ip || !publicAddress(ip)) return { status: 'unavailable', checkedAt };
  if (process.env.SECURITY_GEOIP_PROVIDER !== 'ipapi.co') return { status: 'not_configured', checkedAt };
  try {
    const url = new URL(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (process.env.SECURITY_GEOIP_API_KEY) url.searchParams.set('key', process.env.SECURITY_GEOIP_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error' });
    if (!response.ok) throw new Error('lookup unavailable');
    const data = await response.json() as Record<string, unknown>;
    const latitude = data.latitude, longitude = data.longitude;
    if (data.error || typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('invalid location');
    return { status: 'approximate', checkedAt, latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100, city: clean(data.city), region: clean(data.region), country: clean(data.country_name), provider: clean(data.org) };
  } catch { return { status: 'unavailable', checkedAt }; }
}
