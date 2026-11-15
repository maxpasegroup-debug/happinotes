'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Skeleton, Modal, ModalBody, ModalContent, ModalHeader, ModalFooter, Tooltip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { securityChartData, type SecurityChartGroup } from '@/lib/user-security-charts';
import type { SecurityUser } from '@/lib/user-security';

type Selection = { label: string; userIds: string[] };
type Choose = (selection: Selection) => void;
type ChartData = ReturnType<typeof securityChartData>;
const number = (value: number) => value.toLocaleString('en');
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400';

function Icon({ type }: { type: 'users' | 'device' | 'session' | 'shield' }) {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{type === 'users' ? <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" /></> : type === 'device' ? <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 18h4" /></> : type === 'session' ? <><path d="M3 12h4l3-8 4 16 3-8h4" /></> : <><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5Z" /><path d="M12 7v6m0 4h.01" /></>}</svg>;
}
function ChartCard({ title, subtitle, children, index, action, className = '', footer }: { title: string; subtitle: string; children: ReactNode; index: number; action?: ReactNode; className?: string; footer?: ReactNode }) {
  const reduce = useReducedMotion();
  return <motion.section initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : Math.min(index, 5) * 0.04 }} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151d] shadow-[0_8px_32px_-20px_#000] ${className}`}>
    <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6"><div className="min-w-0"><h3 className="text-[15px] font-semibold tracking-tight text-slate-100">{title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-400">{subtitle}</p></div>{action}</div>
    <div className="flex min-w-0 flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">{children}</div>
    {footer && <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-3 text-[11px] leading-5 text-slate-400 sm:px-6">{footer}</div>}
  </motion.section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 px-5 py-7 text-center"><span className="text-slate-500"><Icon type="session" /></span><p className="max-w-64 text-xs leading-5 text-slate-400">{children}</p></div>;
}
function Legend({ groups, onSelect, onHighlight }: { groups: SecurityChartGroup[]; onSelect: Choose; onHighlight?: (label: string | null) => void }) {
  const total = groups.reduce((sum, item) => sum + item.count, 0);
  return <div className="space-y-1">{groups.map(group => <button key={group.label} type="button" onMouseEnter={() => onHighlight?.(group.label)} onMouseLeave={() => onHighlight?.(null)} onFocus={() => onHighlight?.(group.label)} onBlur={() => onHighlight?.(null)} onClick={() => onSelect(group)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/[0.04] ${focus}`}>
    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: group.color }} /><span className="flex-1 text-slate-300">{group.label}</span><strong className="tabular-nums text-slate-100">{number(group.count)}</strong><span className="w-10 text-right tabular-nums text-slate-500">{Math.round(group.count / Math.max(1, total) * 100)}%</span>
  </button>)}</div>;
}
function Doughnut({ groups, onSelect }: { groups: SecurityChartGroup[]; onSelect: Choose }) {
  const reduce = useReducedMotion(); const [hovered, setHovered] = useState<string | null>(null);
  const total = groups.reduce((sum, item) => sum + item.count, 0), selected = groups.find(item => item.label === hovered), circumference = 2 * Math.PI * 76;
  return <div className="flex h-full flex-col justify-center gap-4">
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 200 200" role="img" aria-label={groups.map(item => `${item.label}: ${item.count}`).join('. ')} className="h-full w-full">
        <circle cx="100" cy="100" r="76" fill="none" stroke="#242b36" strokeWidth="20" />
        {groups.map((group, index) => <motion.circle key={group.label} cx="100" cy="100" r="76" fill="none" stroke={group.color} strokeWidth={selected?.label === group.label ? 24 : 20} transform="rotate(-90 100 100)" strokeDashoffset={-groups.slice(0, index).reduce((sum, item) => sum + item.count, 0) / Math.max(1, total) * circumference}
          initial={reduce ? false : { strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${Math.max(0, group.count / Math.max(1, total) * circumference - (groups.length > 1 ? 5 : 0))} ${circumference}`, opacity: selected && selected.label !== group.label ? 0.3 : 1 }} transition={{ duration: reduce ? 0 : 0.65 }} onMouseEnter={() => setHovered(group.label)} onMouseLeave={() => setHovered(null)}><title>{group.label}: {group.count}</title></motion.circle>)}
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold tracking-tight text-white tabular-nums">{selected?.count ?? total}</span><span className="mt-2 max-w-28 text-center text-[11px] text-slate-400">{selected?.label || 'accounts in view'}</span></div>
    </div><Legend groups={groups} onSelect={onSelect} onHighlight={setHovered} />
  </div>;
}
function HorizontalBars({ groups, onSelect, unit = 'reports' }: { groups: SecurityChartGroup[]; onSelect: Choose; unit?: string }) {
  const reduce = useReducedMotion(), maximum = Math.max(1, ...groups.map(item => item.count));
  if (!groups.length) return <Empty>No {unit} available for these accounts yet.</Empty>;
  return <div className="space-y-4 py-1">{groups.map(group => <Tooltip key={group.label} content={`${group.label} · ${number(group.count)} ${unit} · inspect accounts`} delay={150}><button type="button" aria-label={`${group.label}: ${group.count} ${unit}. Inspect accounts`} onClick={() => onSelect(group)} className={`group block w-full rounded-lg text-left ${focus}`}>
    <span className="mb-2.5 flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-300">{group.label}</span><strong className="tabular-nums text-slate-200">{number(group.count)}</strong></span>
    <span className="block h-5 overflow-hidden rounded-md bg-white/[0.035]"><motion.span className="block h-full rounded-md opacity-85 group-hover:opacity-100" style={{ background: `linear-gradient(90deg, ${group.color}88, ${group.color})` }} initial={reduce ? false : { width: 0 }} animate={{ width: `${group.count / maximum * 100}%` }} transition={{ duration: reduce ? 0 : 0.65, ease: 'easeOut' }} /></span>
  </button></Tooltip>)}</div>;
}
function Columns({ groups, onSelect, unit = 'accounts' }: { groups: SecurityChartGroup[]; onSelect: Choose; unit?: string }) {
  const reduce = useReducedMotion();
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...groups.map(item => item.count)) / 4) * 4);
  if (!groups.length) return <Empty>No {unit} available yet.</Empty>;
  return <div className="relative mt-3 flex-1 pl-7">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44">{[0, 1, 2, 3, 4].map(i => <div key={i} className="absolute right-0 left-7 border-t border-dashed border-white/[0.07]" style={{ top: `${i * 25}%` }}><span className="absolute -left-7 -top-2 text-[10px] tabular-nums text-slate-500">{maximum - i * maximum / 4}</span></div>)}</div>
    <div className="relative flex gap-2">{groups.map(group => <Tooltip key={group.label} content={`${group.label}: ${number(group.count)} ${unit}`}><button type="button" onClick={() => onSelect(group)} aria-label={`${group.label}: ${group.count} ${unit}. Inspect accounts`} className={`group min-w-0 flex-1 rounded-lg ${focus}`}>
      <span className="relative flex h-44 items-end justify-center px-1 sm:px-2"><motion.span className="relative block w-full max-w-14 rounded-t-md opacity-90 group-hover:opacity-100" style={{ background: `linear-gradient(0deg, ${group.color}88, ${group.color})` }} initial={reduce ? false : { height: 0 }} animate={{ height: `${group.count / maximum * 100}%` }} transition={{ duration: reduce ? 0 : 0.65 }}><span className="absolute inset-x-0 -top-6 text-center text-xs font-semibold text-slate-200">{group.count}</span></motion.span></span>
      <span className="mt-3 block min-h-9 break-words text-center text-[10px] leading-4 text-slate-400">{group.label}</span>
    </button></Tooltip>)}</div>
  </div>;
}
function Composition({ groups, onSelect }: { groups: SecurityChartGroup[]; onSelect: Choose }) {
  const reduce = useReducedMotion(), total = groups.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <Empty>No device-location reports available.</Empty>;
  const saved = groups.find(item => item.label === 'Saved location')?.count || 0;
  return <><div className="mb-6 flex items-baseline gap-2"><strong className="text-4xl font-semibold tracking-tight text-white">{Math.round(saved / total * 100)}<span className="text-xl text-slate-400">%</span></strong><span className="text-xs text-slate-400">with a saved point</span></div><div className="mb-5 flex h-4 gap-1 overflow-hidden rounded-md" aria-label="Device location distribution">{groups.map(group => <Tooltip key={group.label} content={`${group.label}: ${group.count}`}><motion.button type="button" aria-label={`${group.label}: ${group.count} reports`} onClick={() => onSelect(group)} className={`h-full rounded-sm ${focus}`} style={{ background: group.color }} initial={reduce ? false : { width: 0 }} animate={{ width: `${group.count / total * 100}%` }} transition={{ duration: reduce ? 0 : 0.6 }} /></Tooltip>)}</div><Legend groups={groups} onSelect={onSelect} /></>;
}
function Activity({ data, onSelect }: { data: ChartData; onSelect: Choose }) {
  const reduce = useReducedMotion(), gradient = useId().replaceAll(':', '');
  const [hovered, setHovered] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(740);
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const right = width - 28, plotWidth = right - 42;
  const maximum = Math.max(4, Math.ceil(Math.max(...data.days.map(item => item.count)) / 4) * 4);
  const points = data.days.map((item, i) => ({ ...item, x: 42 + i / (data.days.length - 1) * plotWidth, y: 224 - item.count / maximum * 184 }));
  const path = points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), current = hovered === null ? undefined : points[hovered];
  const total = points.reduce((sum, item) => sum + item.count, 0), peak = Math.max(...points.map(item => item.count));
  const nearest = (e: React.PointerEvent<SVGSVGElement>) => { const rect = e.currentTarget.getBoundingClientRect(); return Math.max(0, Math.min(points.length - 1, Math.round((((e.clientX - rect.left) / rect.width * width) - 42) / plotWidth * (points.length - 1)))); };
  return <>
    <div className="mb-3 grid max-w-md grid-cols-[1.3fr_1fr_0.8fr] items-end gap-3"><div><span className="text-4xl font-semibold tracking-tight text-white tabular-nums">{number(total)}</span><p className="mt-1 text-[11px] text-slate-400">successful logins in period</p></div><div className="border-l border-white/10 pl-5"><strong className="text-lg font-medium text-slate-200">{(total / data.days.length).toFixed(1)}</strong><p className="mt-1 text-[11px] text-slate-500">daily average</p></div><div><strong className="text-lg font-medium text-orange-300">{peak}</strong><p className="mt-1 text-[11px] text-slate-500">peak day</p></div></div>
    <div ref={container} className="relative mt-auto">
      {current && <div role="status" className="pointer-events-none absolute top-3 z-10 min-w-32 rounded-lg border border-white/15 bg-[#1c2430] px-3 py-2 shadow-xl" style={{ left: Math.min(width - 150, Math.max(0, current.x - 60)) }}><p className="text-[10px] text-slate-400">{current.label} · UTC</p><p className="mt-1 text-xs font-semibold text-white">{current.count} logins</p><p className="mt-1 text-[10px] text-slate-400">Click to inspect accounts</p></div>}
      <svg viewBox={`0 0 ${width} 260`} preserveAspectRatio="none" className="h-[260px] w-full touch-pan-y" role="img" aria-label="Daily successful logins. Use Daily data below for keyboard access." onPointerMove={e => setHovered(nearest(e))} onPointerLeave={() => setHovered(null)} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const i = Math.max(0, Math.min(points.length - 1, Math.round((((e.clientX - rect.left) / rect.width * width) - 42) / plotWidth * (points.length - 1)))); onSelect({ label: `Logins · ${points[i].label} UTC`, userIds: points[i].userIds }); }}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" /><stop offset="100%" stopColor="#fb923c" stopOpacity="0.015" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="42" x2={right} y1={224 - i * 46} y2={224 - i * 46} stroke="#ffffff10" strokeDasharray="4 5" /><text x="28" y={228 - i * 46} textAnchor="end" fill="#94a3b8" fontSize="13">{maximum * i / 4}</text></g>)}
        <motion.path d={`${path} L ${right} 224 L 42 224 Z`} fill={`url(#${gradient})`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.5 }} />
        <motion.path key={points.length} d={path} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.9 }} />
        {points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.ceil((points.length - 1) / (width < 420 ? 2 : 4)) === 0).map(point => <text key={point.date} x={point.x} y="252" fill="#94a3b8" fontSize="13" textAnchor="middle">{point.label}</text>)}
        {current && <g><line x1={current.x} x2={current.x} y1="35" y2="224" stroke="#fb923c77" strokeDasharray="4 4" /><circle cx={current.x} cy={current.y} r="6" fill="#fb923c" stroke="#11151d" strokeWidth="3" /></g>}
      </svg>
    </div>
    <details className="mt-3 text-xs"><summary className="w-fit cursor-pointer text-slate-400 hover:text-orange-300">Daily data & account details</summary><div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-white/10">{data.days.map((point, index) => <button key={point.date} type="button" onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => onSelect({ label: `Logins · ${point.label} UTC`, userIds: point.userIds })} className={`flex w-full justify-between px-3 py-2 text-slate-300 hover:bg-white/5 ${focus}`}><span>{point.label}</span><strong>{point.count}</strong></button>)}</div></details>
  </>;
}
function Heatmap({ data, onSelect }: { data: ChartData; onSelect: Choose }) {
  const maximum = Math.max(1, ...data.heatmap.flatMap(row => row.hours.map(hour => hour.count)));
  return <><div className="overflow-x-auto pb-2"><div className="min-w-[460px]"><div className="mb-3 grid gap-1 pl-9" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center text-[10px] text-slate-500">{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>)}</div><div className="space-y-1.5">{data.heatmap.map(row => <div key={row.label} className="flex items-center gap-2"><span className="w-7 shrink-0 text-[10px] text-slate-400">{row.label}</span><div className="grid flex-1 gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>{row.hours.map(hour => <Tooltip key={hour.label} content={`${hour.label} · ${hour.count} logins`} delay={100}><button type="button" aria-label={`${hour.label}: ${hour.count} successful logins`} onClick={() => onSelect(hour)} className={`h-5 rounded-[3px] border border-white/[0.035] hover:ring-1 hover:ring-orange-200 ${focus}`} style={{ backgroundColor: hour.count ? `rgba(251, 146, 60, ${0.2 + hour.count / maximum * 0.8})` : '#ffffff07' }} /></Tooltip>)}</div></div>)}</div></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>UTC · each cell represents one hour<span className="mt-1 block sm:hidden">Swipe to see all 24 hours →</span></span><span className="flex items-center gap-1.5">Less {[0.05, 0.25, 0.5, 0.75, 1].map(opacity => <span key={opacity} className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgba(251,146,60,${opacity})` }} />)} More</span></div></>;
}
export function SecurityChartsLoading() {
  return <div role="status" aria-label="Loading security charts" aria-busy="true" className="space-y-5"><span className="sr-only">Loading security charts</span><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl motion-reduce:before:animate-none" />)}</div><div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className={`rounded-2xl border border-white/10 bg-[#11151d] p-6 ${i === 0 ? 'lg:col-span-2' : ''}`}><Skeleton className="mb-8 h-4 w-40 rounded motion-reduce:before:animate-none" /><div className="flex h-56 items-end gap-4">{[40, 70, 50, 90, 65, 80].map((height, j) => <Skeleton key={j} style={{ height: `${height}%` }} className="flex-1 rounded-t-lg motion-reduce:before:animate-none" />)}</div></div>)}</div></div>;
}

export default function UserSecurityCharts({ users, loadedAt, onOpenUser }: { users: SecurityUser[]; loadedAt: number; onOpenUser: (user: SecurityUser) => void }) {
  const reduce = useReducedMotion();
  const [days, setDays] = useState<7 | 30>(7);
  const [selection, setSelection] = useState<Selection | null>(null);
  const data = useMemo(() => securityChartData(users, days, new Date(loadedAt)), [users, days, loadedAt]);
  const selectedUsers = users.filter(user => selection?.userIds.includes(user.id));
  const choose: Choose = value => setSelection(value);
  const metrics: { label: string; value: number; note: string; icon: 'users' | 'device' | 'session' | 'shield'; color: string }[] = [
    { label: 'Accounts in view', value: data.users, note: 'Current page & search', icon: 'users', color: '#fb923c' },
    { label: 'Device reports', value: data.devices, note: 'Latest report per installation', icon: 'device', color: '#38bdf8' },
    { label: 'Authorized sessions', value: data.authorized, note: 'Authorization, not online presence', icon: 'session', color: '#34d399' },
    { label: 'VPN detections', value: data.vpnCount, note: `${data.vpn.length} accounts with recorded detections`, icon: 'shield', color: '#fb7185' },
  ];
  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map((metric, i) => <motion.div key={metric.label} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.04 }} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151d] p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-400">{metric.label}</p><span className="hidden rounded-lg p-2 sm:block" style={{ color: metric.color, background: `${metric.color}12` }}><Icon type={metric.icon} /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight text-white tabular-nums sm:text-4xl">{number(metric.value)}</p><p className="mt-2 text-[10px] leading-4 text-slate-500">{metric.note}</p><span className="absolute bottom-0 left-5 h-px w-10" style={{ background: metric.color }} /></motion.div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-slate-100">Access & activity</h2><p className="mt-1 text-xs text-slate-500">Explore sign-ins and the current account snapshot.</p></div><div className="flex items-center gap-3"><span className="text-[11px] text-slate-500">Activity window</span><div className="flex gap-1 rounded-lg border border-white/10 bg-[#11151d] p-1">{([7, 30] as const).map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${focus} ${days === value ? 'bg-orange-400/15 text-orange-300' : 'text-slate-400 hover:text-white'}`}>{value} days</button>)}</div></div></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Login activity" subtitle="Successful sign-ins across the selected period" index={0} className="lg:col-span-2" action={<span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Logins</span>} footer={<>Up to 50 retained logins per account · UTC{data.invalidDates ? ` · ${data.invalidDates} invalid dates excluded` : ''}</>}><Activity key={days} data={data} onSelect={choose} /></ChartCard>
      <ChartCard title="Account access" subtitle="Current authorization status" index={1} footer="Select a legend to inspect the matching accounts."><Doughnut groups={data.access} onSelect={choose} /></ChartCard>
      <ChartCard title="Connection mix" subtitle="Latest device-reported connection types" index={2} footer={`${data.devices} device reports · not current connectivity`}><HorizontalBars groups={data.networks} onSelect={choose} /></ChartCard>
      <ChartCard title="Session outcomes" subtitle="Status of retained successful sign-ins" index={3} footer="Authorized sessions are not necessarily online."><Columns groups={data.sessions} unit="sessions" onSelect={choose} /></ChartCard>
      <ChartCard title="Device platforms" subtitle="Reported OS and Android build identifiers" index={4} footer="Unrecognized or missing OS remains Unknown."><HorizontalBars groups={data.platforms} onSelect={choose} /></ChartCard>
    </div>
    <div className="flex items-center justify-between gap-3 pt-2"><div><h2 className="text-slate-100">Patterns & policy</h2><p className="mt-1 text-xs text-slate-500">Inspect login timing and recorded VPN detections.</p></div><span className="hidden text-[11px] text-slate-500 sm:block">Hover for values · Click to inspect</span></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Login activity by hour" subtitle={`Weekday × hour · successful logins in the last ${days} UTC days`} index={5} className="lg:col-span-2" footer="Darker cells mean fewer retained logins, not a lower security risk."><Heatmap data={data} onSelect={choose} /></ChartCard>
      <ChartCard title="VPN detection distribution" subtitle="Accounts grouped by recorded detection count" index={6} footer="VPN use is not proof of fraud. Counts reflect recorded policy events."><Columns groups={data.vpnBands} onSelect={choose} /></ChartCard>
    </div>
    <div className="pt-2"><h2 className="text-slate-100">Device reporting</h2><p className="mt-1 text-xs text-slate-500">Understand installation coverage, shared location and report age.</p></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Devices per account" subtitle="Number of saved installation reports" index={7} footer="Multiple registered devices do not imply simultaneous active sessions."><Columns groups={data.deviceCounts} onSelect={choose} /></ChartCard>
      <ChartCard title="Location coverage" subtitle="Location-sharing state of saved device reports" index={8} footer="Last shared device points only; IP-derived locations are excluded."><Composition groups={data.location} onSelect={choose} /></ChartCard>
      <ChartCard title="Report freshness" subtitle="Time since the last device report" index={9} footer="Report age is not an online/offline indicator."><HorizontalBars groups={data.freshness} onSelect={choose} /></ChartCard>
    </div>
    <Modal isOpen={Boolean(selection)} onClose={() => setSelection(null)} scrollBehavior="inside" placement="center" classNames={{ base: 'dark admin-ui admin-modal-panel bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent><ModalHeader className="flex-col gap-1 pr-10"><span>{selection?.label}</span><span className="text-xs font-normal text-default-400">{selectedUsers.length} matching accounts on this page</span></ModalHeader><ModalBody><div className="space-y-2">{selectedUsers.map(user => <button key={user.id} type="button" onClick={() => { setSelection(null); onOpenUser(user); }} className={`w-full rounded-xl border border-divider bg-content1 p-3 text-left hover:border-primary/50 ${focus}`}><span className="block truncate text-sm font-semibold">{user.name}</span><span className="mt-1 block truncate text-xs text-default-400">{user.email || 'No email'}</span><span className="mt-2 block text-xs text-primary">View security details ↗</span></button>)}</div>{selectedUsers.length === 0 && <p className="py-6 text-sm text-default-400">No matching accounts in this selection.</p>}</ModalBody><ModalFooter><Button variant="flat" onPress={() => setSelection(null)}>Close</Button></ModalFooter></ModalContent>
    </Modal>
  </div>;
}
