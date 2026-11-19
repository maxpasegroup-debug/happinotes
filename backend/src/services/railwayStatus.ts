import { createHash } from 'crypto';
import { AppError, BadRequestError } from '../utils/errors';

const ENDPOINT = 'https://backboard.railway.com/graphql/v2';
export function railwayTarget() {
  return { projectId: process.env.SYSTEM_STATUS_RAILWAY_PROJECT_ID || '1dd27917-6b55-47ec-b116-d03c43d201f2',
    environmentId: process.env.SYSTEM_STATUS_RAILWAY_ENVIRONMENT_ID || 'f0ec9237-de58-41b1-81f2-4dcadcb8940d',
    serviceId: process.env.SYSTEM_STATUS_RAILWAY_SERVICE_ID || 'bedf0ec2-e8a7-464d-bf9e-fcacfada0769' };
}
export function redactSystemLog(value: unknown): string {
  if (typeof value !== 'string') return '';
  let text = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (!/SECRET|TOKEN|PASSWORD|PRIVATE|KEY|MONGODB_URI|DATABASE_URL/i.test(key) || !secret || secret.length < 6) continue;
    text = text.split(secret).join('[redacted]');
    try { const parsed = JSON.parse(secret); if (parsed && typeof parsed === 'object') for (const [field, value] of Object.entries(parsed)) {
      if (/private_key|password|secret|token/i.test(field) && typeof value === 'string' && value.length > 6) {
        text = text.split(value).join('[redacted]');
        for (const part of value.split(/\r?\n/)) if (part.length > 20) text = text.split(part).join('[redacted]');
      }
    } } catch { /* Most credentials are scalar values. */ }
    if (secret.includes('\n')) for (const part of secret.split(/\r?\n/)) if (part.length > 20) text = text.split(part).join('[redacted]');
  }
  return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[private key redacted]')
    .replace(/\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|redis|https?):\/\/[^\s"'<>]+/gi, '[address redacted]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token redacted]')
    .replace(/(["']?\b[\w.-]*(?:password|secret|token|api[_-]?key|private[_-]?key)[\w.-]*["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi, '$1[redacted]')
    // Terminal control sequences must not reach the log viewer.
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, 4000);
}
const cache = new Map<string, { until: number; value: Promise<unknown> }>();
async function query<T>(key: string, ttl: number, document: string, variables: object): Promise<T> {
  const token = process.env.RAILWAY_TOKEN?.trim();
  if (!token) throw new AppError('The Railway integration is not connected.', 503);
  const identity = createHash('sha256').update(token + JSON.stringify(railwayTarget())).digest('hex');
  const cacheKey = `${identity}:${key}`;
  const old = cache.get(cacheKey);
  if (old && old.until > Date.now()) return old.value as Promise<T>;
  const promise = (async () => {
    let response: globalThis.Response;
    try { response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token }, body: JSON.stringify({ query: document, variables }), signal: AbortSignal.timeout(8000) }); }
    catch { throw new AppError('Railway did not respond. Retrying automatically.', 503); }
    if (response.status === 429) throw new AppError('Railway rate limit reached. Updates will resume automatically.', 503);
    if (!response.ok) throw new AppError('Railway access failed. Check the project token and environment permissions.', 503);
    const body = await response.json() as { data?: T; errors?: unknown[] };
    if (body.errors?.length || !body.data) throw new AppError('Railway could not return this data. Check token scope and service access.', 503);
    return body.data;
  })();
  if (cache.size >= 40) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { until: Date.now() + ttl, value: promise });
  return promise;
}
export type Deployment = { id: string; status: string; createdAt: string };
export async function railwayDeployments() {
  const target = railwayTarget();
  if (!process.env.RAILWAY_TOKEN?.trim()) return { configured: false, target, deployments: [] as Deployment[], checkedAt: new Date().toISOString() };
  const result = await query<{ deployments: { edges: { node: Deployment }[] } }>('deployments', 5000,
    'query StatusDeployments($input: DeploymentListInput!, $first: Int) { deployments(input: $input, first: $first) { edges { node { id status createdAt } } } }', { input: target, first: 12 });
  const deployments = result.deployments.edges.map(({ node }) => ({ id: node.id, status: node.status, createdAt: node.createdAt }));
  deployments.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { configured: true, target, deployments, checkedAt: new Date().toISOString() };
}
export async function railwayLogs(deploymentId: string, kind: 'build' | 'runtime') {
  const scope = await railwayDeployments();
  if (!scope.configured) throw new AppError('The Railway integration is not connected.', 503);
  // No arbitrary deployment lookup: every requested ID must belong to this service.
  if (!scope.deployments.some(item => item.id === deploymentId)) throw new BadRequestError('Choose a deployment from the recent deployment list.');
  const field = kind === 'build' ? 'buildLogs' : 'deploymentLogs';
  const result = await query<Record<string, { timestamp: string; message: string; severity?: string }[]>>(`logs:${kind}:${deploymentId}`, 5000,
    `query StatusLogs($deploymentId: String!, $limit: Int) { ${field}(deploymentId: $deploymentId, limit: $limit) { timestamp message severity } }`, { deploymentId, limit: 200 });
  const logs = result[field].slice(-200).map(line => ({ timestamp: line.timestamp, message:
      line.severity?.toLowerCase() === 'error' && /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\.env\b|process\.env/.test(line.message)
        ? 'Configuration error. Check the deployment settings.'
        : redactSystemLog(line.message), severity: ['error', 'warn', 'warning', 'info', 'debug'].includes(line.severity?.toLowerCase() ?? '') ? line.severity!.toLowerCase() : 'info' }));
  logs.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return { deploymentId, kind, logs, checkedAt: new Date().toISOString() };
}
export async function railwayMetrics() {
  const { environmentId, serviceId } = railwayTarget();
  const result = await query<{ metrics: { measurement: string; values: { ts: number; value: number }[] }[] }>('metrics', 30_000,
    'query StatusMetrics($environmentId: String!, $serviceId: String, $startDate: DateTime!, $measurements: [MetricMeasurement!]!) { metrics(environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, sampleRateSeconds: 60, measurements: $measurements) { measurement values { ts value } } }',
    { environmentId, serviceId, startDate: new Date(Date.now() - 3600_000).toISOString(), measurements: ['CPU_USAGE', 'MEMORY_USAGE_GB', 'DISK_USAGE_GB', 'NETWORK_RX_GB', 'NETWORK_TX_GB'] });
  return { checkedAt: new Date().toISOString(), metrics: result.metrics.map(series => ({ measurement: series.measurement,
    values: series.values.filter(p => Number.isFinite(p.ts) && Number.isFinite(p.value)).slice(-120).map(p => ({ ts: p.ts, value: p.value })) })) };
}
