'use client';
import { Card, CardBody, Chip } from '@heroui/react';
import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { chartGeometry, formatMetric, type Point } from '@/lib/system-status';

export default function SystemMetricChart({ title, subtitle, points, unit, color = '#FB923C', stale = false }: {
  title: string; subtitle: string; points: Point[]; unit: string; color?: string; stale?: boolean;
}) {
  const reduce = useReducedMotion(); const id = useId().replaceAll(':', '');
  const [hover, setHover] = useState<number | null>(null);
  const geometry = chartGeometry(points), valid = points.some(p => p.value !== null);
  const selected = hover === null ? points.length - 1 : Math.min(hover, points.length - 1);
  const value = points[selected], position = geometry.coordinates[selected];
  return <motion.section initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .3 }} className="min-w-0"><Card shadow="none" className="h-full border border-divider bg-gradient-to-br from-content2 to-content1 transition-colors hover:border-divider"><CardBody className="overflow-hidden p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="mt-1 text-[11px] leading-5 text-default-500">{subtitle}</p></div><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}15` }}><span className="h-2 w-2 rounded-full" style={{ background: color }} /></span></div>
    <div className="mt-4 flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{formatMetric(value?.value, unit === 'cores' ? 3 : 1)}</strong><span className="text-xs text-default-500">{unit}</span>{stale && <Chip size="sm" variant="flat" color="warning" className="ml-auto text-[10px]">Last received</Chip>}</div>
    {valid ? <svg viewBox="0 0 360 208" role="img" tabIndex={0} aria-label={`${title}. ${formatMetric(value?.value)} ${unit}. Use left and right arrows to inspect samples.`} className="mt-3 w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - box.left) / box.width * 360; let nearest = 0; geometry.coordinates.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(geometry.coordinates[nearest].x - x)) nearest = i; }); setHover(nearest); }} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setHover(Math.max(0, Math.min(points.length - 1, selected + (event.key === 'ArrowLeft' ? -1 : 1)))); } }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".1" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <rect x="44" y="24" width="296" height="150" fill={`url(#${id})`} />
      {[0, 1, 2, 3].map(i => <g key={i}><line x1="44" x2="340" y1={24 + i * 50} y2={24 + i * 50} stroke="hsl(var(--heroui-divider))" strokeDasharray="4 5" /><text x="36" y={28 + i * 50} fill="hsl(var(--heroui-default-500))" fontSize="10" textAnchor="end">{formatMetric(geometry.max * (1 - i / 3), 2)}</text></g>)}
      <path d={geometry.line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {position?.y != null && <><line x1={position.x} x2={position.x} y1="24" y2="174" stroke={color} opacity=".25" /><circle cx={position.x} cy={position.y} r="4" fill={color} stroke="hsl(var(--heroui-content1))" strokeWidth="2" /></>}
      <text x="44" y="199" fill="hsl(var(--heroui-default-500))" fontSize="10">{points[0] ? new Date(points[0].at).toLocaleTimeString() : ''}</text><text x="340" y="199" fill="hsl(var(--heroui-default-500))" fontSize="10" textAnchor="end">{value ? new Date(value.at).toLocaleTimeString() : ''}</text>
    </svg> : <div className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-divider px-5 text-center text-xs leading-6 text-default-500">{points.length ? 'No measurement available in this window.' : 'Waiting for measured samples. No estimated data is shown.'}</div>}
  </CardBody></Card></motion.section>;
}
