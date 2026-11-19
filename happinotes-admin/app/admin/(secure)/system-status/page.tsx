'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Progress, Select, SelectItem, Skeleton, Switch, Tab, Tabs, Tooltip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import SystemMetricChart from '@/components/admin/SystemMetricChart';
import SystemStatusAnimation from '@/components/admin/SystemStatusAnimation';
import { deploymentTone, formatBytes, formatMetric, formatUptime, infrastructurePoints, mongoConnectionUsage, type Deployments, type Infrastructure, type LogResult, type Sample, type SystemStatus } from '@/lib/system-status';

const backend = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://happinotes-production-6b44.up.railway.app').replace(/\/+$/, '');
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const base = process.env.NODE_ENV === 'development' ? '/api/backend' : backend;
  const response = await fetch(`${base}/admin/system-status${path}`, { cache: 'no-store', signal, headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` } });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Admin access expired. Sign in again to monitor the system.');
    if (response.status === 404) throw new Error('Deploy the updated backend to enable System Status.');
    if (response.status === 429) throw new Error('Monitoring requests are rate limited. Retrying automatically.');
    throw new Error(path ? 'Railway data is unavailable. Check the backend token and service access.' : 'The API is not responding. Retrying automatically; previous data is marked stale.');
  }
  return response.json();
}
// One bounded, non-overlapping poll per channel; hidden tabs pause and focus refreshes.
function useMonitor<T>(path: string | null, interval: number, enabled: boolean) {
  const [result, setResult] = useState<{ path: string; data: T } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (path === null || !enabled) return;
    let active = true, inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true; setBusy(true);
      try { const data = await read<T>(path, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])); if (active) { setResult({ path, data }); setError(''); } }
      catch (exception) { if (active) setError(exception instanceof Error && exception.name !== 'TypeError' && exception.name !== 'TimeoutError' ? exception.message : 'Connection unavailable. Retrying automatically.'); }
      finally { inFlight = false; if (active) setBusy(false); }
    };
    void load(); const timer = setInterval(() => void load(), interval);
    const wake = () => void load(); document.addEventListener('visibilitychange', wake); window.addEventListener('focus', wake);
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); };
  }, [path, interval, enabled, retry]);
  return { data: result?.path === path ? result.data : null, error, busy, refresh: () => setRetry(n => n + 1) };
}
function MetricIcon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    server: 'M4 3h16v7H4z M4 14h16v7H4z M7 6h.01 M7 17h.01 M11 6h6 M11 17h6',
    database: 'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3Z M4 6v12c0 2 4 3 8 3s8-1 8-3V6 M4 12c0 2 4 3 8 3s8-1 8-3',
    build: 'M8 4H4v4 M4 4l7 7 M16 20h4v-4 M20 20l-7-7 M17 3l4 4-7 7-4-4Z M3 17l4 4 4-4-4-4Z',
    activity: 'M2 12h5l3-8 4 16 3-8h5',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 3 M4 16l2 3a7 7 0 0 0 12-2',
    memory: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
    search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  };
  return <svg aria-hidden="true" className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.activity} /></svg>;
}
function StatusCard({ label, value, description, tone = 'default', icon }: { label: string; value: string; description: string; tone?: 'success' | 'danger' | 'warning' | 'default'; icon: string }) {
  return <Card shadow="none" className="min-w-0 border border-white/[.08] bg-gradient-to-br from-[#171c26] to-[#10141c]">
    <CardBody className="gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-400">{label}</span><span className="rounded-xl border border-white/5 bg-white/[.035] p-2.5 text-slate-400"><MetricIcon name={icon} /></span></div>
      <Chip size="lg" variant="dot" color={tone} classNames={{ base: 'max-w-full border-white/10', content: 'truncate font-semibold' }}>{value}</Chip>
      <p className="min-h-10 text-xs leading-5 text-slate-400">{description}</p>
    </CardBody>
  </Card>;
}
function Notice({ children }: { children: React.ReactNode }) {
  return <Alert color="warning" variant="flat" title="Connection notice" description={children} classNames={{ base: 'border border-warning/15 bg-warning/5', description: 'text-xs leading-6' }} />;
}
function ChartSkeletons({ count }: { count: number }) {
  return <div aria-label="Loading system metrics" aria-busy="true" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: count }, (_, i) => <Card key={i} shadow="none" className="border border-white/10 bg-[#131820]"><CardBody className="gap-4 p-6"><Skeleton className="h-4 w-32 rounded-lg" /><Skeleton className="h-8 w-24 rounded-lg" /><Skeleton className="mt-4 h-40 rounded-xl" /></CardBody></Card>)}</div>;
}
function MongoStorage({ mongo, fresh }: { mongo: SystemStatus['mongo'] | undefined; fresh: boolean }) {
  const usage = mongoConnectionUsage(mongo?.connections, mongo?.availableConnections);
  const sizes = [
    { label: 'Data', value: mongo?.dataBytes, hint: 'Logical document size', color: 'success' as const },
    { label: 'Storage', value: mongo?.storageBytes, hint: 'Allocated document storage', color: 'primary' as const },
    { label: 'Indexes', value: mongo?.indexBytes, hint: 'Index storage size', color: 'secondary' as const },
  ];
  const largest = Math.max(1, ...sizes.map(size => size.value ?? 0));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">MongoDB storage & capacity</h2><p className="mt-1 text-xs text-slate-400">Database footprint and available connections, together in one place.</p></div><Chip size="sm" variant="flat" color={fresh ? 'success' : 'warning'} startContent={<MetricIcon name="clock" />}>{mongo?.sampledAt ? `${fresh ? 'Measured' : 'Last received'} ${new Date(mongo.sampledAt).toLocaleTimeString()}` : 'Awaiting statistics'}</Chip></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {sizes.map(size => <Card key={size.label} shadow="none" className="border border-white/[.08] bg-[#131820]"><CardBody className="gap-2 p-5"><p className="text-xs text-slate-400">{size.label}</p><Tooltip content={size.value == null ? 'Measurement unavailable' : `${formatMetric(size.value, 0)} bytes`}><p className="w-fit text-2xl font-semibold tracking-tight tabular-nums text-white" tabIndex={0}>{formatBytes(size.value)}</p></Tooltip><p className="text-[11px] text-slate-500">{size.hint}</p></CardBody></Card>)}
      <Card shadow="none" className="border border-emerald-400/15 bg-gradient-to-br from-emerald-400/[.06] to-[#131820]"><CardBody className="gap-2 p-5"><p className="text-xs text-slate-400">Documents</p><p className="text-2xl font-semibold tabular-nums text-white">{formatMetric(mongo?.objects, 0)}</p><p className="text-[11px] text-slate-500">Across {formatMetric(mongo?.collections, 0)} collections</p></CardBody></Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card shadow="none" className="border border-white/[.08] bg-[#131820]"><CardHeader className="justify-between px-6 pt-6"><div><h3 className="text-sm text-white">Storage footprint</h3><p className="mt-1 text-xs text-slate-500">Compare the measured sizes</p></div><span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-400"><MetricIcon name="database" /></span></CardHeader><CardBody className="gap-5 px-6 pb-6">
        {sizes.map(size => <div key={size.label}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">{size.label}</span><span className="tabular-nums text-slate-200">{formatBytes(size.value)}</span></div>{size.value == null ? <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-500">Measurement unavailable</p> : <Progress aria-label={`${size.label} relative size`} value={size.value} maxValue={largest} size="sm" color={size.color} classNames={{ track: 'bg-white/5' }} />}</div>)}
        <p className="text-[11px] leading-5 text-slate-500">Bars show relative sizes, not disk utilization. Logical data, allocated storage and indexes measure different things; the server does not report a disk limit here.</p>
      </CardBody></Card>
      <Card shadow="none" className="border border-white/[.08] bg-[#131820]"><CardHeader className="justify-between px-6 pt-6"><div><h3 className="text-sm text-white">Connection capacity</h3><p className="mt-1 text-xs text-slate-500">Reported by the MongoDB server</p></div><span className="rounded-xl bg-sky-400/10 p-3 text-sky-400"><MetricIcon name="activity" /></span></CardHeader><CardBody className="gap-5 px-6 pb-6">
        <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-400">Connections available</p><p className="mt-2 text-3xl font-semibold tabular-nums text-white">{formatMetric(mongo?.availableConnections, 0)}</p></div><div><p className="text-xs text-slate-400">Active connections</p><p className="mt-2 text-3xl font-semibold tabular-nums text-white">{formatMetric(mongo?.connections, 0)}</p></div></div>
        {usage ? <Progress aria-label="Connection capacity used" label="Capacity in use" value={usage.percent} showValueLabel valueLabel={usage.percent > 0 && usage.percent < .01 ? '<0.01%' : `${formatMetric(usage.percent, 2)}%`} color="primary" size="sm" classNames={{ label: 'text-xs text-slate-400', value: 'text-xs text-slate-300', track: 'bg-white/5' }} /> : <p className="text-xs text-slate-500">Connection capacity is unavailable.</p>}
        <Divider className="bg-white/[.07]" /><div className="grid grid-cols-2 gap-4 text-xs"><div><p className="text-slate-500">Database uptime</p><p className="mt-1 font-medium text-slate-300">{formatUptime(mongo?.uptimeSeconds ?? undefined)}</p></div><div><p className="text-slate-500">Resident memory</p><p className="mt-1 font-medium text-slate-300">{mongo?.residentMiB == null ? '—' : formatBytes(mongo.residentMiB * 1048576)}</p></div></div>
      </CardBody></Card>
    </div>
    {mongo && (!mongo.serverStatsAvailable || !mongo.databaseStatsAvailable) && <Notice>Some MongoDB statistics are unavailable. The database account may need monitoring privileges; ping health remains independent.</Notice>}
  </div>;
}
const chartSpec: { key: keyof Sample; title: string; subtitle: string; unit: string; color: string }[] = [
  { key: 'cpuCores', title: 'CPU activity', subtitle: 'API process · one core = 100% of a CPU', unit: 'cores', color: '#fb923c' },
  { key: 'rssMiB', title: 'Resident memory', subtitle: 'Physical memory used by this API process', unit: 'MiB', color: '#a78bfa' },
  { key: 'requestsPerSecond', title: 'Request throughput', subtitle: 'Completed API requests · monitoring excluded', unit: 'req/s', color: '#38bdf8' },
  { key: 'responseP95Ms', title: 'Response latency', subtitle: '95th percentile · no traffic means no sample', unit: 'ms', color: '#2dd4bf' },
  { key: 'errorRate', title: 'Server error rate', subtitle: 'HTTP 5xx as a percentage of completed requests', unit: '%', color: '#fb7185' },
  { key: 'eventLoopP95Ms', title: 'Event loop delay', subtitle: '95th percentile · runtime scheduling delay', unit: 'ms', color: '#facc15' },
  { key: 'mongoPingMs', title: 'MongoDB response', subtitle: 'Round-trip ping from the API to MongoDB', unit: 'ms', color: '#4ade80' },
  { key: 'mongoConnections', title: 'Database connections', subtitle: 'MongoDB server · sampled every 30 seconds', unit: 'connections', color: '#38bdf8' },
  { key: 'mongoOperationsPerSecond', title: 'Database operations', subtitle: 'Server-wide operations · includes monitoring', unit: 'ops/s', color: '#c084fc' },
];
export default function SystemStatusPage() {
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const reduce = useReducedMotion(); const [tab, setTab] = useState<'overview' | 'database' | 'deployments' | 'infrastructure'>('overview');
  const [paused, setPaused] = useState(false), [minutes, setMinutes] = useState(15), [selected, setSelected] = useState('latest');
  const [kind, setKind] = useState<'build' | 'runtime'>('build'), [search, setSearch] = useState(''), [follow, setFollow] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const system = useMonitor<SystemStatus>('', 5000, !paused);
  const builds = useMonitor<Deployments>('/deployments', 10000, !paused);
  const deployment = builds.data?.deployments.find(d => d.id === selected) ?? (selected === 'latest' ? builds.data?.deployments[0] : undefined);
  const logs = useMonitor<LogResult>(deployment ? `/logs?${new URLSearchParams({ deploymentId: deployment.id, kind })}` : null, 5000, !paused && tab === 'deployments');
  const infra = useMonitor<Infrastructure>('/infrastructure', 30000, !paused && tab === 'infrastructure' && builds.data?.configured === true);
  const latest = system.data?.samples.at(-1);
  const fresh = Boolean(now > 0 && system.data?.sampledAt && now - Date.parse(system.data.sampledAt) < 20000 && !system.error && !paused);
  const cutoff = Date.parse(system.data?.sampledAt || '') - minutes * 60_000;
  const samples = system.data?.samples.filter(p => Date.parse(p.at) >= cutoff) ?? [];
  const lineCount = logs.data?.logs.length ?? 0, lastLog = logs.data?.logs.at(-1)?.timestamp;
  useEffect(() => { if (follow && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [lineCount, lastLog, follow]);
  const refresh = () => { system.refresh(); builds.refresh(); logs.refresh(); infra.refresh(); };
  const mongo = system.data?.mongo;
  const renderCharts = (database: boolean) => !system.data && !system.error ? <ChartSkeletons count={database ? 3 : 6} /> :
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{chartSpec.filter(chart => chart.key.startsWith('mongo') === database).map(chart => <SystemMetricChart key={chart.key} title={chart.title} subtitle={chart.subtitle} unit={chart.unit} color={chart.color} stale={!fresh} points={samples.map(s => ({ at: s.at, value: typeof s[chart.key] === 'number' ? s[chart.key] as number : null }))} />)}</div>;
  const filteredLogs = logs.data?.logs.filter(line => line.message.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="w-full min-w-0 space-y-6 text-slate-200">
    <motion.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#202028] via-[#151922] to-[#11151c] p-6 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-32 h-80 w-80 rounded-full bg-primary/[.07] blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6"><SystemStatusAnimation /><div className="min-w-0"><h1 className="!text-3xl font-semibold tracking-tight sm:!text-4xl">System Status</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">A clear view of your platform. Track service health, explore database capacity and follow every deployment.</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><Chip size="sm" color={fresh ? 'success' : paused ? 'warning' : 'default'} variant="dot" className="mr-1 border-white/10">{paused ? 'Paused' : system.error ? 'Disconnected' : fresh ? 'Live · 5 sec' : 'Connecting'}</Chip><Button size="sm" variant="bordered" className="border-white/15" onPress={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</Button><Tooltip content="Refresh monitoring data"><Button size="sm" color="primary" className="font-semibold shadow-lg shadow-primary/10" isDisabled={paused} isLoading={system.busy} startContent={!system.busy && <MetricIcon name="refresh" />} onPress={refresh}>Refresh</Button></Tooltip></div>
      </div>
      <Divider className="my-6 bg-white/[.07]" /><div className="relative flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><span className="flex items-center gap-2"><MetricIcon name="server" />{system.data?.region || 'Connected API'}<span className="text-slate-600">/</span>{system.data?.nodeVersion || 'Awaiting runtime'}</span><span className="flex items-center gap-2"><MetricIcon name="clock" />Last sample: {system.data?.sampledAt ? new Date(system.data.sampledAt).toLocaleTimeString() : 'Waiting'}</span></div>
    </motion.header>
    {system.error && <Notice>{system.error}</Notice>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatusCard icon="server" label="API server" value={system.error ? 'Unreachable' : !system.data ? 'Connecting' : fresh ? 'Responding' : 'Not current'} tone={fresh ? 'success' : system.error ? 'danger' : 'warning'} description={system.data ? `Uptime ${formatUptime(system.data.uptimeSeconds)} · ${system.data.nodeVersion}` : 'Waiting for the first authenticated health sample.'} />
      <StatusCard icon="database" label="MongoDB" value={!fresh ? 'Unknown' : latest?.mongoConnected ? 'Connected' : 'Unavailable'} tone={!fresh ? 'default' : latest?.mongoConnected ? 'success' : 'danger'} description={latest?.mongoConnected ? `Last ping ${formatMetric(latest.mongoPingMs)} ms · ${formatMetric(mongo?.collections, 0)} collections` : 'Database health is verified with a bounded ping.'} />
      <StatusCard icon="build" label="Latest deployment" value={builds.error ? 'Unavailable' : builds.data?.configured === false ? 'Setup needed' : builds.data?.deployments[0]?.status || 'Waiting'} tone={builds.error ? 'warning' : deploymentTone(builds.data?.deployments[0]?.status)} description={builds.data?.deployments[0] ? `Created ${new Date(builds.data.deployments[0].createdAt).toLocaleString()}` : 'Build state is read from Railway, separately from API health.'} />
      <StatusCard icon="memory" label="Memory / heap" value={latest ? `${formatMetric(latest.rssMiB, 0)} MiB` : 'Waiting'} description={latest ? `Heap ${formatMetric(latest.heapMiB)} / ${formatMetric(latest.heapTotalMiB)} MiB · ${fresh ? 'current process' : 'last received'}` : 'Actual process memory, not the host machine total.'} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 pt-2"><div><h2 className="font-semibold text-white">Platform insights</h2><p className="mt-1 text-xs text-slate-500">{tab === 'database' ? 'MongoDB health and capacity · statistics every 30 seconds' : tab === 'overview' ? 'Process performance · measured every 5 seconds' : tab === 'deployments' ? 'Deployment activity and live output' : 'Infrastructure measurements from Railway'}</p></div>{(tab === 'overview' || tab === 'database') && <Select aria-label="Chart time range" size="sm" selectedKeys={[String(minutes)]} disallowEmptySelection onSelectionChange={keys => { const next = Number(Array.from(keys)[0]); if ([5, 15, 60].includes(next)) setMinutes(next); }} startContent={<MetricIcon name="clock" />} className="w-44" classNames={{ trigger: 'border border-white/10 bg-[#171c26]', value: 'text-xs' }} popoverProps={{ classNames: { content: 'dark bg-[#171c26] text-slate-200 border border-white/10' } }}>{[5, 15, 60].map(n => <SelectItem key={String(n)} textValue={`Last ${n} minutes`}>{`Last ${n} minutes`}</SelectItem>)}</Select>}</div>
    <Tabs aria-label="System views" selectedKey={tab} onSelectionChange={key => setTab(key as typeof tab)} color="primary" variant="solid" radius="lg" disableAnimation={Boolean(reduce)} classNames={{ base: 'max-w-full', tabList: 'gap-1 border border-white/[.08] bg-[#131820] p-1.5', tab: 'h-11 px-4 sm:px-5', tabContent: 'text-xs font-semibold group-data-[selected=true]:text-white', cursor: 'bg-primary shadow-lg shadow-primary/10', panel: 'min-w-0 space-y-6 px-0 pt-6' }}>
      <Tab key="overview" title={<span className="flex items-center gap-2"><MetricIcon name="server" />Server overview</span>}>
        <p className="text-xs leading-6 text-slate-500">{system.data?.scope || 'Measurements are collected from the connected API process.'}</p>
        {renderCharts(false)}
      </Tab>
      <Tab key="database" title={<span className="flex items-center gap-2"><MetricIcon name="database" />Database</span>}>
        {!system.data && !system.error ? <ChartSkeletons count={4} /> : <MongoStorage mongo={mongo} fresh={fresh && Boolean(latest?.mongoConnected)} />}
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">Database performance</h2><span className="text-xs text-slate-500">Last {minutes} minutes</span></div>
        {renderCharts(true)}
      </Tab>
      <Tab key="deployments" title={<span className="flex items-center gap-2"><MetricIcon name="build" />Builds & live logs</span>}>
        {builds.error && <Notice>{builds.error}</Notice>}
        {builds.data?.configured === false && <Notice>Connect Railway to view deployments and logs.</Notice>}
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card shadow="none" className="h-fit border border-white/[.08] bg-[#131820]"><CardHeader className="flex-col items-start gap-2 px-5 pt-5"><h2 className="font-semibold">Deployment history</h2><p className="text-xs leading-5 text-slate-500">Latest 12 builds · checked every 10 seconds.</p></CardHeader><CardBody className="gap-4 p-5"><Button fullWidth size="sm" variant={selected === 'latest' ? 'flat' : 'bordered'} color="primary" onPress={() => setSelected('latest')} startContent={<MetricIcon name="activity" />}>Follow latest deployment</Button><div className="max-h-[520px] space-y-2 overflow-y-auto">{builds.data?.deployments.map(item => <Button key={item.id} fullWidth variant="flat" aria-pressed={deployment?.id === item.id} onPress={() => setSelected(item.id)} className={`h-auto justify-start whitespace-normal rounded-xl border p-4 text-left ${deployment?.id === item.id ? 'border-primary/30 bg-primary/[.07]' : 'border-white/5 bg-white/[.02]'}`}><span className="w-full"><span className="flex items-center justify-between gap-2"><Chip size="sm" variant="flat" color={deploymentTone(item.status)}>{item.status}</Chip><span className="font-mono text-[10px] text-slate-500">{item.id.slice(0, 8)}</span></span><span className="mt-3 block text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</span></span></Button>)}{!builds.data?.deployments.length && <p className="py-10 text-center text-xs text-slate-500">No deployments received yet.</p>}</div></CardBody></Card>
          <Card shadow="none" className="min-w-0 border border-white/[.08] bg-[#0c1017]"><CardHeader className="block border-b border-white/[.08] p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{kind === 'build' ? 'Build output' : 'Runtime output'}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Latest 200 lines · refreshed every 5 seconds · credentials redacted</p></div><Chip color={deploymentTone(deployment?.status)} variant="flat">{deployment?.status || 'No build selected'}</Chip></div>
            <div className="mt-5 flex flex-wrap items-center gap-3"><Tabs aria-label="Log type" size="sm" selectedKey={kind} onSelectionChange={key => setKind(key as typeof kind)} color="primary" variant="bordered" disableAnimation={Boolean(reduce)}><Tab key="build" title="Build logs" /><Tab key="runtime" title="Runtime logs" /></Tabs><Input aria-label="Filter log lines" size="sm" value={search} onValueChange={setSearch} placeholder="Find in logs…" startContent={<MetricIcon name="search" />} isClearable onClear={() => setSearch('')} className="min-w-[150px] flex-1" classNames={{ inputWrapper: 'border border-white/10 bg-white/5' }} /><Switch size="sm" isSelected={follow} onValueChange={setFollow} classNames={{ label: 'text-xs text-slate-400' }}>Auto-scroll</Switch></div>
            {deployment && <div className="mt-5 flex flex-wrap gap-2">{['QUEUED', 'BUILDING', 'DEPLOYING', 'SUCCESS'].map((stage, index) => <Chip key={stage} size="sm" variant={deployment.status === stage ? 'flat' : 'bordered'} color={deployment.status === stage ? 'primary' : 'default'} className={deployment.status === stage ? '' : 'border-white/10 text-slate-500'} startContent={<span className="pl-1 text-[10px]">0{index + 1}</span>}>{stage === 'SUCCESS' ? 'RUNNING' : stage}</Chip>)}</div>}
          </CardHeader><CardBody className="p-0">
            {logs.error && <div className="p-4"><Notice>{logs.error} The displayed lines are from the last successful update.</Notice></div>}
            <div ref={scroll} role="region" aria-label="Deployment log output" tabIndex={0} className="h-[480px] overflow-auto p-5 font-mono text-[11px] leading-7 focus-visible:outline-primary">{filteredLogs.map((line, i) => <div key={`${line.timestamp}-${i}`} className="flex gap-4 border-b border-white/[.025] hover:bg-white/[.025]"><span className="shrink-0 select-none text-slate-600">{new Date(line.timestamp).toLocaleTimeString()}</span><span className={`whitespace-pre-wrap break-all ${line.severity === 'error' ? 'text-rose-300' : ['warn', 'warning'].includes(line.severity) ? 'text-amber-300' : 'text-slate-300'}`}>{line.message}</span></div>)}{!filteredLogs.length && <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-slate-500"><MetricIcon name={search ? 'search' : 'build'} /><p>{logs.busy && !logs.data ? 'Reading deployment logs…' : search && logs.data?.logs.length ? 'No log lines match your search.' : 'No log lines available for this deployment yet.'}</p></div>}</div>
            <Divider className="bg-white/[.07]" /><div className="flex justify-between px-5 py-3 text-[10px] text-slate-500"><span>{filteredLogs.length} lines shown</span><span>{paused ? 'Updates paused' : 'Updates every 5 seconds'}</span></div>
          </CardBody></Card>
        </div>
      </Tab>
      <Tab key="infrastructure" title={<span className="flex items-center gap-2"><MetricIcon name="activity" />Railway metrics</span>}>
        {builds.error && <Notice>{builds.error}</Notice>}
        {builds.data?.configured === false && <Notice>Connect Railway to view infrastructure metrics.</Notice>}
        <p className="text-xs leading-6 text-slate-500">Railway service measurements · last hour · 60-second samples · refreshed every 30 seconds. Provider metrics may arrive with a delay.</p>{infra.error && <Notice>{infra.error}</Notice>}
        {infra.busy && !infra.data ? <ChartSkeletons count={5} /> : <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{[['CPU_USAGE', 'Service CPU', 'cores', '#fb923c'], ['MEMORY_USAGE_GB', 'Service memory', 'GB', '#a78bfa'], ['DISK_USAGE_GB', 'Persistent disk', 'GB', '#38bdf8'], ['NETWORK_RX_GB', 'Network received', 'GB', '#2dd4bf'], ['NETWORK_TX_GB', 'Network sent', 'GB', '#facc15']].map(([measurement, title, unit, color]) => <SystemMetricChart key={measurement} title={title} unit={unit} color={color} subtitle="Railway aggregate · configured backend service" stale={Boolean(infra.error) || paused} points={infrastructurePoints(infra.data, measurement)} />)}</div>}
      </Tab>
    </Tabs>
  </div>;
}
