'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { addToast, Button, Skeleton, Tooltip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import type * as Three from 'three';
import { applicationCharts, type AnalyticsSnapshot, type ChartGroup } from '@/lib/admin-dashboard-charts';
import { downloadCsv } from '@/lib/api';

const numeric = (n: number) => n.toLocaleString('en');
const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400';
function Panel({ title, note, index, wide, children, footer, unavailable = false }: { title: string; note: string; index: number; wide?: boolean; children: ReactNode; footer: string; unavailable?: boolean }) {
  const reduce = useReducedMotion();
  return <motion.section initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .4, delay: reduce ? 0 : Math.min(index, 4) * .06 }} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[.08] bg-[#11151d] shadow-[0_12px_40px_-28px_#000] ${wide ? 'lg:col-span-2' : ''}`}>
    <div className="flex items-start justify-between gap-4 px-5 pt-6 sm:px-6"><div><h2 className="text-[15px] font-semibold tracking-tight text-slate-100">{title}</h2><p className="mt-1.5 text-xs leading-5 text-slate-400">{note}</p></div><span aria-hidden="true" className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/5 text-[10px] font-medium tabular-nums text-slate-500">{String(index + 1).padStart(2, '0')}</span></div>
    <div className="flex min-w-0 flex-1 flex-col px-5 pb-6 pt-5 sm:px-6">{unavailable ? <Empty>Data unavailable. Refresh charts to try again.</Empty> : children}</div>
    <p className="border-t border-white/[.06] bg-white/[.015] px-5 py-3 text-[10px] leading-5 text-slate-500 sm:px-6">{footer}</p>
  </motion.section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="flex min-h-56 flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 px-7 text-center text-xs leading-6 text-slate-400">{children}</div>;
}
function Donut({ groups, label }: { groups: ChartGroup[]; label: string }) {
  const reduce = useReducedMotion(), [selected, setSelected] = useState<string | null>(null);
  const total = groups.reduce((sum, group) => sum + group.count, 0), current = groups.find(group => group.label === selected), length = 2 * Math.PI * 76;
  return <div className="flex flex-1 flex-col justify-center gap-5"><div className="relative mx-auto h-52 w-52">
    <svg viewBox="0 0 200 200" role="img" aria-label={groups.map(group => `${group.label}: ${group.count}`).join('. ')} className="h-full w-full"><circle cx="100" cy="100" r="76" stroke="#232b38" strokeWidth="19" fill="none" />{groups.filter(group => group.count > 0).map(group => {
      const index = groups.indexOf(group), offset = groups.slice(0, index).reduce((sum, row) => sum + row.count, 0);
      return <motion.circle key={group.label} cx="100" cy="100" r="76" stroke={group.color} strokeWidth={selected === group.label ? 24 : 19} fill="none" transform="rotate(-90 100 100)" strokeDashoffset={-offset / total * length} initial={reduce ? false : { strokeDasharray: `0 ${length}` }} animate={{ strokeDasharray: `${Math.max(0, group.count / total * length - (groups.filter(g => g.count).length > 1 ? 5 : 0))} ${length}`, opacity: selected && selected !== group.label ? .25 : 1 }} transition={{ duration: reduce ? 0 : .7 }} onMouseEnter={() => setSelected(group.label)} onMouseLeave={() => setSelected(null)}><title>{group.label}: {group.count}</title></motion.circle>;
    })}</svg><div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-4xl font-semibold tracking-tight tabular-nums text-white">{numeric(current?.count ?? total)}</strong><span className="mt-2 max-w-28 text-center text-[10px] text-slate-400">{current?.label || label}</span></div></div>
    <div className="space-y-1">{groups.map(group => <button key={group.label} type="button" onMouseEnter={() => setSelected(group.label)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(group.label)} onBlur={() => setSelected(null)} onClick={() => setSelected(selected === group.label ? null : group.label)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-xs hover:bg-white/5 ${focusStyle}`}><span className="h-2 w-2 rounded-sm" style={{ background: group.color }} /><span className="flex-1 text-left text-slate-300">{group.label}</span><strong className="tabular-nums text-slate-200">{numeric(group.count)}</strong><span className="w-10 text-right tabular-nums text-slate-500">{Math.round(group.count / Math.max(total, 1) * 100)}%</span></button>)}</div>
  </div>;
}
function Bars({ groups }: { groups: ChartGroup[] }) {
  const reduce = useReducedMotion(), total = groups.reduce((sum, group) => sum + group.count, 0), max = Math.max(1, ...groups.map(group => group.count));
  if (!total) return <Empty>No records yet. The chart will appear as your library grows.</Empty>;
  return <div className="space-y-4">{groups.map(group => <Tooltip key={group.label} content={`${group.label} · ${numeric(group.count)} records · ${Math.round(group.count / total * 100)}%`} delay={100}><button type="button" aria-label={`${group.label}: ${group.count}`} className={`group block w-full rounded text-left ${focusStyle}`}><span className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="truncate capitalize text-slate-300">{group.label}</span><strong className="text-slate-200">{numeric(group.count)}</strong></span><span className="block h-4 overflow-hidden rounded bg-white/[.035]"><motion.span initial={reduce ? false : { width: 0 }} animate={{ width: `${group.count / max * 100}%` }} transition={{ duration: reduce ? 0 : .7 }} className="block h-full rounded opacity-80 group-hover:opacity-100" style={{ background: `linear-gradient(90deg, ${group.color}66, ${group.color})` }} /></span></button></Tooltip>)}</div>;
}
function Columns({ groups }: { groups: ChartGroup[] }) {
  const reduce = useReducedMotion();
  const maximum = Math.max(4, Math.ceil(Math.max(...groups.map(group => group.count)) / 4) * 4);
  return <div className="relative mt-5 pl-6"><div aria-hidden="true" className="absolute inset-x-0 top-0 h-52">{[0, 1, 2, 3, 4].map(i => <div key={i} className="absolute right-0 left-6 border-t border-dashed border-white/[.08]" style={{ top: `${i * 25}%` }}><span className="absolute -left-6 -top-2 text-[10px] text-slate-500">{maximum - i * maximum / 4}</span></div>)}</div><div className="relative flex gap-2">{groups.map(group => <Tooltip key={group.label} content={`${group.label}: ${group.count} clips`}><button type="button" aria-label={`${group.label}: ${group.count} clips`} className={`min-w-0 flex-1 rounded ${focusStyle}`}><span className="flex h-52 items-end justify-center px-1"><motion.span initial={reduce ? false : { height: 0 }} animate={{ height: `${group.count / maximum * 100}%` }} transition={{ duration: reduce ? 0 : .65 }} className="relative block w-full max-w-12 rounded-t-md" style={{ background: `linear-gradient(0deg, ${group.color}55, ${group.color})` }}><span className="absolute inset-x-0 -top-6 text-center text-[11px] font-medium text-slate-200">{group.count}</span></motion.span></span><span className="mt-3 block min-h-8 text-[9px] leading-4 text-slate-400">{group.label}</span></button></Tooltip>)}</div></div>;
}
type Month = { key: string; label: string; year: number; count: number };
function Trend({ series, headline, description }: { series: { label: string; color: string; rows: Month[] }[]; headline: number; description: string }) {
  const reduce = useReducedMotion(), id = useId().replaceAll(':', '');
  const box = useRef<HTMLDivElement>(null), [width, setWidth] = useState(650), [active, setActive] = useState<number | null>(null), [focused, setFocused] = useState<number | null>(null);
  useEffect(() => { if (!box.current) return; const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width))); observer.observe(box.current); return () => observer.disconnect(); }, []);
  const max = Math.max(4, Math.ceil(Math.max(...series.flatMap(s => s.rows.map(row => row.count))) / 4) * 4), right = width - 24, span = right - 35, rows = series[0].rows;
  const highlighted = active ?? focused;
  const current = highlighted !== null && highlighted < rows.length ? highlighted : null;
  const x = (i: number) => 35 + i / (rows.length - 1) * span, y = (value: number) => 220 - value / max * 175;
  const total = series.reduce((sum, item) => sum + item.rows.reduce((n, row) => n + row.count, 0), 0);
  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><strong className="text-4xl font-semibold tracking-tight tabular-nums text-white">{numeric(headline)}</strong><p className="mt-2 text-[11px] text-slate-400">{description}</p></div><div className="text-right"><strong className="text-xl font-medium tabular-nums text-orange-300">+{numeric(total)}</strong><p className="mt-1 text-[10px] text-slate-500">created in this period</p></div></div>
    <div className="mb-2 flex flex-wrap gap-4">{series.map(s => <span key={s.label} className="flex items-center gap-2 text-[10px] text-slate-400"><span className="h-1.5 w-4 rounded" style={{ background: s.color }} />{s.label}</span>)}</div>
    <div ref={box} className="relative mt-auto">
      {current !== null && <div role="status" className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-lg border border-white/10 bg-[#202938] px-3 py-2 shadow-xl" style={{ left: Math.max(0, Math.min(width - 165, x(current) - 60)) }}><p className="mb-1 text-[10px] text-slate-400">{rows[current].label} {rows[current].year} · UTC</p>{series.map(s => <p key={s.label} className="text-xs leading-5 text-slate-200">{s.label}: <strong>{s.rows[current].count}</strong></p>)}</div>}
      <svg viewBox={`0 0 ${width} 255`} className="h-[255px] w-full touch-pan-y" preserveAspectRatio="none" role="img" aria-label={series.map(s => `${s.label}: ${s.rows.map(r => `${r.label} ${r.year}, ${r.count}`).join('; ')}`).join('. ')} onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setActive(Math.max(0, Math.min(rows.length - 1, Math.round(((e.clientX - rect.left) / rect.width * width - 35) / span * (rows.length - 1))))); }} onPointerLeave={() => setActive(null)}>
        <defs>{series.map((s, i) => <linearGradient key={s.label} id={`${id}-${i}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".25" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="35" x2={right} y1={y(max * i / 4)} y2={y(max * i / 4)} stroke="#ffffff10" strokeDasharray="4 5" /><text x="24" y={y(max * i / 4) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{max * i / 4}</text></g>)}
        {series.map((s, si) => { const path = s.rows.map((row, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(row.count)}`).join(' '); return <g key={s.label}><motion.path d={`${path} L ${right} 220 L 35 220 Z`} fill={`url(#${id}-${si})`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} /><motion.path key={rows.length} d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : .9 }} /></g>; })}
        {rows.map((row, i) => i === rows.length - 1 || i % Math.ceil(rows.length / (width < 420 ? 3 : 6)) === 0 ? <text key={row.key} x={x(i)} y="248" textAnchor="middle" fontSize="11" fill="#94a3b8">{row.label}</text> : null)}
        {current !== null && <g><line x1={x(current)} x2={x(current)} y1="30" y2="220" stroke="#ffffff55" strokeDasharray="3 4" />{series.map(s => <circle key={s.label} cx={x(current)} cy={y(s.rows[current].count)} r="5" fill={s.color} stroke="#11151d" strokeWidth="2" />)}</g>}
      </svg>
    </div><div className="mt-3 flex flex-wrap gap-1" aria-label="Inspect monthly chart values">{rows.map((row, i) => <button type="button" key={row.key} aria-label={`${row.label} ${row.year}: ${series.map(s => `${s.rows[i].count} ${s.label}`).join(', ')}`} onFocus={() => setFocused(i)} onBlur={() => setFocused(null)} onClick={() => setActive(current === i ? null : i)} className={`rounded px-2 py-1 text-[10px] ${focusStyle} ${current === i ? 'bg-orange-400/15 text-orange-300' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>{row.label}</button>)}</div>
  </>;
}
type DashboardChartsData = ReturnType<typeof applicationCharts>;
function SheetTable({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<unknown>> }) {
  return <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0f141c]" aria-label={title}>
    <div className="border-b border-white/10 bg-[#171e29] px-4 py-3"><h3 className="text-xs font-semibold uppercase tracking-[.14em] text-slate-300">{title}</h3></div>
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left font-mono text-xs">
        <thead><tr className="bg-[#1b2431]">{['#', ...headers].map((header, index) => <th key={`${header}-${index}`} className="border-b border-r border-white/10 px-3 py-2.5 font-semibold text-slate-400 last:border-r-0">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={`${title}-${rowIndex}`} className="even:bg-white/[.018] hover:bg-orange-400/[.05]">{[rowIndex + 1, ...row].map((value, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className={`border-b border-r border-white/[.07] px-3 py-2.5 align-top last:border-r-0 ${cellIndex === 0 ? 'text-slate-600' : 'text-slate-200'}`}>{value == null || value === '' ? '—' : String(value)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}
function CsvView({ data, charts, months }: { data: AnalyticsSnapshot; charts: DashboardChartsData; months: 6 | 12 }) {
  const monthlyRows = charts.signups.rows.map((row, index) => [
    `${row.label} ${row.year}`,
    data.users === null ? 'Unavailable' : row.count,
    data.books === null ? 'Unavailable' : charts.bookGrowth.rows[index]?.count ?? 0,
    data.bites === null ? 'Unavailable' : charts.biteGrowth.rows[index]?.count ?? 0,
  ]);
  const summaryRows = [
    ['Total accounts', data.users === null ? 'Unavailable' : charts.users.length],
    ['Life Books', data.books === null ? 'Unavailable' : charts.books.length],
    ['Happy Bites', data.bites === null ? 'Unavailable' : charts.bites.length],
    ['Active Pro subscribers', data.stats === null ? 'Unavailable' : data.stats.activePremiumSubscribers],
    ['Total Pro-capable accounts', data.stats === null ? 'Unavailable' : data.stats.totalUsers],
  ];
  const groups = (items: ChartGroup[]) => items.map(item => [item.label, item.count, `${Math.round(item.count / Math.max(1, items.reduce((sum, group) => sum + group.count, 0)) * 100)}%`]);
  const exportRows = [
    ['Monthly activity', 'Period', 'New accounts', 'Life Books created', 'Happy Bites created'],
    ...monthlyRows.map(row => ['Monthly activity', ...row]),
    ['Summary', 'Metric', 'Value'],
    ...summaryRows.map(row => ['Summary', ...row]),
    ['Publication pipeline', 'Group', 'Count', 'Share'],
    ...groups(charts.publication).map(row => ['Publication pipeline', ...row]),
    ['Content access', 'Group', 'Count', 'Share'],
    ...groups(charts.access).map(row => ['Content access', ...row]),
    ['Life Book languages', 'Group', 'Count', 'Share'],
    ...groups(charts.languages).map(row => ['Life Book languages', ...row]),
    ['Happy Bites categories', 'Group', 'Count', 'Share'],
    ...groups(charts.categories).map(row => ['Happy Bites categories', ...row]),
    ['Happy Bites duration', 'Group', 'Count', 'Share'],
    ...groups(charts.durations).map(row => ['Happy Bites duration', ...row]),
    ['Account access', 'Group', 'Count', 'Share'],
    ...groups(charts.accounts).map(row => ['Account access', ...row]),
  ];
  const download = () => {
    downloadCsv(`happinotes-dashboard-${months}-months-${new Date().toISOString().slice(0, 10)}.csv`, ['Section', 'Period or metric', 'Value', 'Secondary value', 'Share'], exportRows);
    addToast({ title: 'Dashboard CSV ready', description: `Exported the ${months}-month dashboard view.`, severity: 'success', timeout: 3500, shouldShowTimeoutProgress: true });
  };
  return <div className="space-y-5">
    <div className="flex justify-end"><Button size="sm" variant="bordered" onPress={download}>Download CSV</Button></div>
    <SheetTable title="Monthly activity" headers={['Period', 'New accounts', 'Life Books created', 'Happy Bites created']} rows={monthlyRows} />
    <div className="grid gap-5 lg:grid-cols-2"><SheetTable title="Current summary" headers={['Metric', 'Value']} rows={summaryRows} /><SheetTable title="Publication pipeline" headers={['Group', 'Count', 'Share']} rows={groups(charts.publication)} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><SheetTable title="Content access" headers={['Group', 'Count', 'Share']} rows={groups(charts.access)} /><SheetTable title="Account access" headers={['Group', 'Count', 'Share']} rows={groups(charts.accounts)} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><SheetTable title="Life Book languages" headers={['Group', 'Count', 'Share']} rows={groups(charts.languages)} /><SheetTable title="Happy Bites categories" headers={['Group', 'Count', 'Share']} rows={groups(charts.categories)} /></div>
    <SheetTable title="Happy Bites duration" headers={['Group', 'Count', 'Share']} rows={groups(charts.durations)} />
  </div>;
}
type DashboardPlotRow = { key: string; label: string; accounts: number; books: number; bites: number; content: number };
function dashboardPlotRows(charts: DashboardChartsData): DashboardPlotRow[] {
  return charts.signups.rows.map((row, index) => {
    const books = charts.bookGrowth.rows[index]?.count || 0;
    const bites = charts.biteGrowth.rows[index]?.count || 0;
    return { key: row.key, label: `${row.label} ${row.year}`, accounts: row.count, books, bites, content: books + bites };
  });
}
function hexagonPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 3 * index + Math.PI / 6;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(' ');
}
export function HexbinView({ charts, months }: { charts: DashboardChartsData; months: 6 | 12 }) {
  const rows = dashboardPlotRows(charts);
  const columns = 6, binRows = 5, maxX = Math.max(1, ...rows.map(row => row.accounts)), maxY = Math.max(1, ...rows.map(row => row.content));
  const bins = new Map<string, { column: number; row: number; points: DashboardPlotRow[] }>();
  rows.forEach(point => {
    const column = Math.min(columns - 1, Math.floor(point.accounts / (maxX + 1) * columns));
    const row = Math.min(binRows - 1, Math.floor(point.content / (maxY + 1) * binRows));
    const key = `${column}-${row}`;
    const bin = bins.get(key) || { column, row, points: [] };
    bin.points.push(point); bins.set(key, bin);
  });
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><Panel index={0} wide title="Hexbin Plot" note={`Monthly accounts against new audio content · last ${months} months`} footer="Each hexagon is binned from real monthly dashboard values. Empty areas are not inferred activity."><svg viewBox="0 0 760 380" role="img" aria-label="Hexbin plot of monthly accounts and new audio content" className="h-[360px] w-full"><line x1="70" y1="320" x2="730" y2="320" stroke="#ffffff25" /><line x1="70" y1="24" x2="70" y2="320" stroke="#ffffff25" /><text x="400" y="365" textAnchor="middle" fill="#94a3b8" fontSize="11">New accounts</text><text x="18" y="176" textAnchor="middle" fill="#94a3b8" fontSize="11" transform="rotate(-90 18 176)">New audio content</text>{[...bins.values()].map(bin => { const cx = 70 + (bin.column + .5) / columns * 660, cy = 320 - (bin.row + .5) / binRows * 270, intensity = .28 + bin.points.length / Math.max(1, rows.length) * .72; return <polygon key={`${bin.column}-${bin.row}`} points={hexagonPoints(cx, cy, 36)} fill={`rgba(56,189,248,${intensity})`} stroke="#67e8f9" strokeOpacity=".55"><title>{bin.points.map(point => `${point.label}: ${point.accounts} accounts, ${point.content} titles`).join(' · ')}</title></polygon>; })}{rows.map(point => { const x = 70 + point.accounts / (maxX || 1) * 660, y = 320 - point.content / (maxY || 1) * 270; return <circle key={point.key} cx={x} cy={y} r="3.5" fill="#f8fafc"><title>{point.label}: {point.accounts} accounts, {point.content} titles</title></circle>; })}</svg></Panel><Panel index={1} title="Binned source rows" note="Exact values behind the plot" footer="All rows come from the current dashboard snapshot."><div className="space-y-2">{rows.map(row => <div key={row.key} className="flex items-center justify-between rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-xs"><span className="text-slate-400">{row.label}</span><span className="tabular-nums text-slate-200">{row.accounts} accounts · {row.content} titles</span></div>)}</div></Panel></div>;
}
export function Scatter3DView({ charts, months }: { charts: DashboardChartsData; months: 6 | 12 }) {
  const mount = useRef<HTMLDivElement>(null), reduce = useReducedMotion(), rows = useMemo(() => dashboardPlotRows(charts), [charts]);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    const target = mount.current;
    if (!target) return;
    let cancelled = false, frame = 0, cleanup: (() => void) | null = null;
    void import('three').then(THREE => {
      if (cancelled || !mount.current) return;
      try {
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
        camera.position.set(0, 1.2, 9);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0); renderer.domElement.setAttribute('aria-hidden', 'true'); renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; target.appendChild(renderer.domElement);
        const group = new THREE.Group(); scene.add(group);
        const maxAccounts = Math.max(1, ...rows.map(row => row.accounts)), maxContent = Math.max(1, ...rows.map(row => row.content)), maxMix = Math.max(1, ...rows.map(row => Math.abs(row.books - row.bites)));
        const positions: number[] = [], colors: number[] = [];
        rows.forEach(row => { positions.push((row.accounts / maxAccounts - .5) * 5.6, (row.content / maxContent - .5) * 4.1, (row.books - row.bites) / maxMix * 2.6); const color = new THREE.Color(row.bites >= row.books ? '#38bdf8' : '#fb923c'); colors.push(color.r, color.g, color.b); });
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, opacity: .95, sizeAttenuation: true })); group.add(points);
        const grid = new THREE.GridHelper(6.8, 10, 0x38bdf8, 0x1e293b); grid.rotation.x = Math.PI / 2; grid.position.y = -2.05; grid.material.transparent = true; grid.material.opacity = .3; group.add(grid);
        const resize = () => { const width = Math.max(280, target.clientWidth), height = Math.max(320, target.clientHeight); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }; const observer = new ResizeObserver(resize); observer.observe(target); resize();
        const clock = new THREE.Clock(); const render = () => { if (cancelled) return; if (!reduce) group.rotation.y = Math.sin(clock.getElapsedTime() * .3) * .32; renderer.render(scene, camera); if (!reduce) frame = window.requestAnimationFrame(render); }; render(); setUnsupported(false);
        cleanup = () => { window.cancelAnimationFrame(frame); observer.disconnect(); geometry.dispose(); (points.material as Three.Material).dispose(); (grid.geometry as Three.BufferGeometry).dispose(); (grid.material as Three.Material).dispose(); renderer.dispose(); if (renderer.domElement.parentNode === target) target.removeChild(renderer.domElement); };
      } catch { if (!cancelled) setUnsupported(true); }
    }).catch(() => { if (!cancelled) setUnsupported(true); });
    return () => { cancelled = true; cleanup?.(); };
  }, [reduce, rows]);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><Panel index={0} wide title="3D Scatter Plot" note={`Monthly accounts, content and Life Book/Happy Bite mix · last ${months} months`} footer="Axes use real monthly values: X accounts, Y titles, Z Life Books minus Happy Bites."><div ref={mount} role="img" aria-label="Three-dimensional scatter plot of monthly dashboard metrics" className="relative h-[390px] overflow-hidden rounded-xl border border-white/[.08] bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,.12),transparent_52%),#0c1119]"><div className="pointer-events-none absolute left-4 top-4 z-10 text-[10px] leading-5 text-slate-500">X · accounts<br />Y · titles<br />Z · Life Books ↔ Happy Bites</div>{unsupported && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs leading-6 text-slate-400">3D rendering is unavailable in this browser. The source rows remain available beside the plot.</div>}</div></Panel><Panel index={1} title="Scatter source rows" note="Exact monthly coordinates" footer="No synthetic points are added."><div className="space-y-2">{rows.map(row => <div key={row.key} className="rounded-lg border border-white/[.07] bg-white/[.02] px-3 py-2 text-xs"><div className="flex items-center justify-between"><span className="text-slate-400">{row.label}</span><strong className="tabular-nums text-slate-200">{row.accounts} accounts</strong></div><p className="mt-1 text-[10px] text-slate-500">{row.books} Life Books · {row.bites} Happy Bites</p></div>)}</div></Panel></div>;
}
export default function DashboardCharts({ data, months, view = 'charts' }: { data: AnalyticsSnapshot | null; months: 6 | 12; view?: 'charts' | 'csv' }) {
  const charts = useMemo(() => data ? applicationCharts(data, months) : null, [data, months]);
  if (!data || !charts) return <div role="status" aria-label="Loading application charts" aria-busy="true" className="grid gap-5 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className={`rounded-2xl border border-divider bg-[#11151d] p-6 ${i === 0 || i === 2 ? 'lg:col-span-2' : ''}`}><Skeleton className="h-4 w-40 rounded motion-reduce:before:animate-none" /><Skeleton className="mt-4 h-3 w-48 rounded motion-reduce:before:animate-none" /><div className="mt-10 flex h-60 items-end gap-4">{[45, 70, 55, 85, 65, 95].map((height, j) => <Skeleton key={j} style={{ height: `${height}%` }} className="flex-1 rounded-t motion-reduce:before:animate-none" />)}</div></div>)}</div>;
  if (view === 'csv') return <CsvView data={data} charts={charts} months={months} />;
  const both = data.books !== null && data.bites !== null;
  return <div className="grid gap-5 lg:grid-cols-3">
    <Panel index={0} wide title="Community growth" note={`New accounts by month · last ${months} months`} footer={`All account roles · UTC calendar months${charts.signups.excluded ? ` · ${charts.signups.excluded} missing or future dates excluded` : ''}`} unavailable={!data.users}><Trend series={[{ label: 'New accounts', color: '#fb923c', rows: charts.signups.rows }]} headline={charts.users.length} description="registered accounts across the application" /></Panel>
    <Panel index={1} title="Pro membership" note="Current subscription coverage" footer="Active, unexpired subscriptions from the existing entitlement system." unavailable={!charts.membership}><Donut groups={charts.membership || []} label="accounts" /></Panel>
    <Panel index={2} wide title="Library growth" note={`Life Books and Happy Bites created · last ${months} months`} footer={`Creation dates across all publish states${charts.bookGrowth.excluded + charts.biteGrowth.excluded ? ` · ${charts.bookGrowth.excluded + charts.biteGrowth.excluded} missing or future dates excluded` : ''}`} unavailable={!both}><Trend series={[{ label: 'Life Books', color: '#fb923c', rows: charts.bookGrowth.rows }, { label: 'Happy Bites', color: '#38bdf8', rows: charts.biteGrowth.rows }]} headline={charts.books.length + charts.bites.length} description="titles in your complete audio library" /></Panel>
    <Panel index={3} title="Library composition" note="The two sides of your listening experience" footer="All Life Books and Happy Bites, including unpublished content." unavailable={!both}><Donut groups={charts.catalog} label="audio titles" /></Panel>
    <Panel index={4} title="Publication pipeline" note="Published, upcoming and in progress" footer="Current publication states · all records, not just the selected period." unavailable={!both}><Bars groups={charts.publication} /></Panel>
    <Panel index={5} title="Content access" note="Free listening and paid content" footer="Paid access includes premium books and Pro Happy Bites." unavailable={!both}><Donut groups={charts.access} label="audio titles" /></Panel>
    <Panel index={6} title="Life Book languages" note="Language coverage across your catalogue" footer="Largest language groups · smaller groups combined when necessary." unavailable={!data.books}><Bars groups={charts.languages} /></Panel>
    <Panel index={7} title="Happy Bites categories" note="Discover the themes in your library" footer="All Happy Bites · largest categories and a combined remainder." unavailable={!data.bites}><Bars groups={charts.categories} /></Panel>
    <Panel index={8} title="Happy Bites duration" note="From short thoughts to longer listening" footer="Saved audio duration · missing and zero durations shown as not measured." unavailable={!data.bites}><Columns groups={charts.durations} /></Panel>
    <Panel index={9} title="Account access" note="Current account blocking snapshot" footer="Blocked flag across all accounts · not an online presence indicator." unavailable={!data.users}><Donut groups={charts.accounts} label="accounts" /></Panel>
  </div>;
}
