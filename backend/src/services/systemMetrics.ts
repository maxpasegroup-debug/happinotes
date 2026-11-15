import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { monitorEventLoopDelay, performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export type SystemSample = {
  at: string; cpuCores: number; rssMiB: number; heapMiB: number; heapTotalMiB: number; eventLoopP95Ms: number | null;
  requestsPerSecond: number; requests: number; errors5xx: number; errors4xx: number; errorRate: number | null; responseP95Ms: number | null;
  mongoPingMs: number | null; mongoConnected: boolean; mongoConnections: number | null; mongoOperationsPerSecond: number | null;
};
export function percentile(values: number[], percent: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percent) - 1)];
}
export function sanitizeMongoStats(server: Record<string, any> | null, db: Record<string, any> | null) {
  return {
    connections: finite(server?.connections?.current), availableConnections: finite(server?.connections?.available),
    residentMiB: finite(server?.mem?.resident), uptimeSeconds: finite(server?.uptime),
    operations: server?.opcounters ? Object.values(server.opcounters).reduce<number>((sum, value) => sum + (finite(value) ?? 0), 0) : null,
    dataBytes: finite(db?.dataSize), storageBytes: finite(db?.storageSize), indexBytes: finite(db?.indexSize), collections: finite(db?.collections), objects: finite(db?.objects),
    serverStatsAvailable: Boolean(server), databaseStatsAvailable: Boolean(db),
  };
}
let counts = { requests: 0, errors5xx: 0, errors4xx: 0, durations: [] as number[] };
export const recordSystemRequest: RequestHandler = (req, res, next) => {
  // Do not record URLs, headers or identities. Exclude the monitor's own traffic.
  if (/(?:^|\/)admin\/system-status(?:\/|$)/.test(req.path) || req.path === '/health' || req.path.startsWith('/uploads/')) { next(); return; }
  const start = performance.now();
  res.once('finish', () => {
    counts.requests++;
    if (res.statusCode >= 500) counts.errors5xx++;
    else if (res.statusCode >= 400) counts.errors4xx++;
    // Bounded latency reservoir; the UI identifies this as a sample at high load.
    const duration = performance.now() - start;
    if (counts.durations.length < 2000) counts.durations.push(duration);
    else { const index = Math.floor(Math.random() * counts.requests); if (index < 2000) counts.durations[index] = duration; }
  });
  next();
};
const samples: SystemSample[] = [];
const instance = randomUUID();
let started = false, sampling: Promise<void> | null = null;
let clock = performance.now(), cpu = process.cpuUsage();
const delay = monitorEventLoopDelay({ resolution: 20 });
let mongoStats = sanitizeMongoStats(null, null), mongoStatsAt: string | null = null, statsCheckedAt = 0;
let previousOps: { at: number; operations: number; uptime: number } | null = null;
let mongoOperationsPerSecond: number | null = null;

async function sample() {
  const now = performance.now(), elapsed = Math.max(1, now - clock), used = process.cpuUsage(cpu);
  cpu = process.cpuUsage(); clock = now;
  const window = counts; counts = { requests: 0, errors5xx: 0, errors4xx: 0, durations: [] };
  const mem = process.memoryUsage();
  const loop = delay.count > 0 ? delay.percentile(95) / 1e6 : null; delay.reset();
  let ping: number | null = null, connected = false;
  const db = mongoose.connection.readyState === 1 ? mongoose.connection.db : undefined;
  if (db) {
    const begin = performance.now();
    try {
      await db.command({ ping: 1, maxTimeMS: 1500 }, { timeoutMS: 2000 });
      ping = performance.now() - begin; connected = true;
    } catch { /* Disconnection or timeout remains explicitly unavailable. */ }
    if (connected && Date.now() - statsCheckedAt >= 30_000) {
      statsCheckedAt = Date.now();
      const [server, database] = await Promise.allSettled([
        db.admin().command({ serverStatus: 1, maxTimeMS: 1500 }, { timeoutMS: 2000 }),
        db.command({ dbStats: 1, scale: 1, freeStorage: 0, maxTimeMS: 1500 }, { timeoutMS: 2000 }),
      ]);
      mongoStats = sanitizeMongoStats(server.status === 'fulfilled' ? server.value : null, database.status === 'fulfilled' ? database.value : null);
      mongoStatsAt = new Date().toISOString();
      const opNow = Date.now();
      mongoOperationsPerSecond = previousOps && mongoStats.operations !== null && mongoStats.uptimeSeconds !== null &&
        mongoStats.operations >= previousOps.operations && mongoStats.uptimeSeconds >= previousOps.uptime
        ? (mongoStats.operations - previousOps.operations) / Math.max(0.001, (opNow - previousOps.at) / 1000) : null;
      previousOps = mongoStats.operations !== null && mongoStats.uptimeSeconds !== null ? { at: opNow, operations: mongoStats.operations, uptime: mongoStats.uptimeSeconds } : null;
    }
  }
  if (!connected) { mongoStats = sanitizeMongoStats(null, null); mongoStatsAt = null; statsCheckedAt = 0; previousOps = null; mongoOperationsPerSecond = null; }
  samples.push({ at: new Date().toISOString(), cpuCores: (used.user + used.system) / (elapsed * 1000), rssMiB: mem.rss / 1048576,
    heapMiB: mem.heapUsed / 1048576, heapTotalMiB: mem.heapTotal / 1048576, eventLoopP95Ms: loop,
    requestsPerSecond: window.requests / (elapsed / 1000), requests: window.requests, errors5xx: window.errors5xx, errors4xx: window.errors4xx,
    errorRate: window.requests ? window.errors5xx / window.requests * 100 : null, responseP95Ms: percentile(window.durations, 0.95),
    mongoPingMs: ping, mongoConnected: connected, mongoConnections: mongoStats.connections, mongoOperationsPerSecond });
  if (samples.length > 720) samples.splice(0, samples.length - 720);
}
export function collectSystemSample(): Promise<void> {
  if (!sampling) sampling = sample().finally(() => { sampling = null; });
  return sampling;
}
export function startSystemMetrics(): () => void {
  if (started) return () => {};
  started = true; delay.enable();
  void collectSystemSample().catch(() => {});
  const timer = setInterval(() => { void collectSystemSample().catch(() => {}); }, 5000);
  timer.unref();
  return () => { clearInterval(timer); delay.disable(); started = false; };
}
export function systemSnapshot() {
  return { sampledAt: samples.at(-1)?.at ?? null, instance, uptimeSeconds: process.uptime(), nodeVersion: process.version,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null, region: process.env.RAILWAY_REPLICA_REGION || null,
    scope: 'Current API process; up to one hour in memory. History resets on restart. Latency uses up to 2,000 sampled requests per interval.',
    intervalSeconds: 5, samples: [...samples], mongo: { ...mongoStats, sampledAt: mongoStatsAt } };
}
