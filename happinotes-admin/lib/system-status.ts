export type Sample = {
  at: string; cpuCores: number; rssMiB: number; heapMiB: number; heapTotalMiB: number; eventLoopP95Ms: number | null;
  requestsPerSecond: number; requests: number; errors5xx: number; errors4xx: number; errorRate: number | null; responseP95Ms: number | null;
  mongoPingMs: number | null; mongoConnected: boolean; mongoConnections: number | null; mongoOperationsPerSecond: number | null;
};
export type SystemStatus = { sampledAt: string | null; instance: string; uptimeSeconds: number; nodeVersion: string; deploymentId: string | null; region: string | null; scope: string; intervalSeconds: number; samples: Sample[];
  mongo: { sampledAt: string | null; connections: number | null; availableConnections: number | null; residentMiB: number | null; uptimeSeconds: number | null; dataBytes: number | null; storageBytes: number | null; indexBytes: number | null; collections: number | null; objects: number | null; serverStatsAvailable: boolean; databaseStatsAvailable: boolean } };
export type Deployment = { id: string; status: string; createdAt: string };
export type Deployments = { configured: boolean; checkedAt: string; target: { projectId: string; serviceId: string; environmentId: string }; deployments: Deployment[] };
export type LogResult = { deploymentId: string; kind: 'build' | 'runtime'; checkedAt: string; logs: { timestamp: string; message: string; severity: string }[] };
export type Infrastructure = { checkedAt: string; metrics: { measurement: string; values: { ts: number; value: number }[] }[] };
export type Point = { at: string; value: number | null };
export const formatMetric = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en', { maximumFractionDigits: digits });
export function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const power = value > 0 ? Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(value) / Math.log(1024)))) : 0;
  return `${formatMetric(value / 1024 ** power, power ? 1 : 0)} ${units[power]}`;
}
export function mongoConnectionUsage(active: number | null | undefined, available: number | null | undefined) {
  if (active == null || available == null || !Number.isFinite(active) || !Number.isFinite(available) || active < 0 || available < 0 || active + available === 0) return null;
  return { total: active + available, percent: active / (active + available) * 100 };
}
export const formatUptime = (value?: number) => value == null ? '—' : value >= 86400 ? `${Math.floor(value / 86400)}d ${Math.floor(value % 86400 / 3600)}h` : value >= 3600 ? `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m` : `${Math.floor(value / 60)}m ${Math.floor(value % 60)}s`;
export function deploymentTone(status?: string): 'success' | 'danger' | 'warning' | 'default' {
  return status === 'SUCCESS' ? 'success' : ['FAILED', 'CRASHED'].includes(status ?? '') ? 'danger' : ['BUILDING', 'DEPLOYING', 'QUEUED', 'WAITING'].includes(status ?? '') ? 'warning' : 'default';
}
export function chartGeometry(points: Point[]) {
  const times = points.map(p => Date.parse(p.at));
  const first = Math.min(...times), last = Math.max(...times);
  const max = Math.max(0.01, ...points.map(p => p.value ?? 0)) * 1.15;
  let drawing = false;
  const coordinates = points.map((p, i) => ({ x: 44 + (last > first ? (times[i] - first) / (last - first) : 0.5) * 296, y: p.value == null ? null : 174 - p.value / max * 150 }));
  const line = coordinates.map(p => {
    if (p.y == null) { drawing = false; return ''; }
    const segment = `${drawing ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`; drawing = true; return segment;
  }).join(' ');
  return { line, coordinates, max };
}
export function infrastructurePoints(data: Infrastructure | null, measurement: string): Point[] {
  const series = data?.metrics.filter(s => s.measurement === measurement) ?? [];
  // Ungrouped Railway queries return aggregate series. Preserve provider units.
  return (series[0]?.values ?? []).map(p => ({ at: new Date(p.ts < 1e12 ? p.ts * 1000 : p.ts).toISOString(), value: p.value })).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
