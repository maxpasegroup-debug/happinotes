'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Accordion, AccordionItem, Button, Pagination, Skeleton, Modal, ModalBody, ModalContent, ModalHeader, ModalFooter, Tooltip } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import type * as Three from 'three';
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
  return <motion.section initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : Math.min(index, 5) * 0.04 }} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-divider bg-content1 shadow-[0_8px_32px_-20px_#000] ${className}`}>
    <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6"><div className="min-w-0"><h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3><p className="mt-1.5 text-xs leading-5 text-default-500">{subtitle}</p></div>{action}</div>
    <div className="flex min-w-0 flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">{children}</div>
    {footer && <div className="border-t border-divider bg-content2 px-5 py-3 text-[11px] leading-5 text-default-500 sm:px-6">{footer}</div>}
  </motion.section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-divider px-5 py-7 text-center"><span className="text-default-500"><Icon type="session" /></span><p className="max-w-64 text-xs leading-5 text-default-500">{children}</p></div>;
}
function Legend({ groups, onSelect, onHighlight }: { groups: SecurityChartGroup[]; onSelect: Choose; onHighlight?: (label: string | null) => void }) {
  const total = groups.reduce((sum, item) => sum + item.count, 0);
  return <div className="space-y-1">{groups.map(group => <button key={group.label} type="button" onMouseEnter={() => onHighlight?.(group.label)} onMouseLeave={() => onHighlight?.(null)} onFocus={() => onHighlight?.(group.label)} onBlur={() => onHighlight?.(null)} onClick={() => onSelect(group)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs hover:bg-content2 ${focus}`}>
    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: group.color }} /><span className="flex-1 text-default-600">{group.label}</span><strong className="tabular-nums text-foreground">{number(group.count)}</strong><span className="w-10 text-right tabular-nums text-default-500">{Math.round(group.count / Math.max(1, total) * 100)}%</span>
  </button>)}</div>;
}
function Doughnut({ groups, onSelect }: { groups: SecurityChartGroup[]; onSelect: Choose }) {
  const reduce = useReducedMotion(); const [hovered, setHovered] = useState<string | null>(null);
  const total = groups.reduce((sum, item) => sum + item.count, 0), selected = groups.find(item => item.label === hovered), circumference = 2 * Math.PI * 76;
  return <div className="flex h-full flex-col justify-center gap-4">
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 200 200" role="img" aria-label={groups.map(item => `${item.label}: ${item.count}`).join('. ')} className="h-full w-full">
        <circle cx="100" cy="100" r="76" fill="none" stroke="hsl(var(--heroui-content3))" strokeWidth="20" />
        {groups.map((group, index) => <motion.circle key={group.label} cx="100" cy="100" r="76" fill="none" stroke={group.color} strokeWidth={selected?.label === group.label ? 24 : 20} transform="rotate(-90 100 100)" strokeDashoffset={-groups.slice(0, index).reduce((sum, item) => sum + item.count, 0) / Math.max(1, total) * circumference}
          initial={reduce ? false : { strokeDasharray: `0 ${circumference}` }} animate={{ strokeDasharray: `${Math.max(0, group.count / Math.max(1, total) * circumference - (groups.length > 1 ? 5 : 0))} ${circumference}`, opacity: selected && selected.label !== group.label ? 0.3 : 1 }} transition={{ duration: reduce ? 0 : 0.65 }} onMouseEnter={() => setHovered(group.label)} onMouseLeave={() => setHovered(null)}><title>{group.label}: {group.count}</title></motion.circle>)}
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">{selected?.count ?? total}</span><span className="mt-2 max-w-28 text-center text-[11px] text-default-500">{selected?.label || 'accounts in view'}</span></div>
    </div><Legend groups={groups} onSelect={onSelect} onHighlight={setHovered} />
  </div>;
}
function HorizontalBars({ groups, onSelect, unit = 'reports' }: { groups: SecurityChartGroup[]; onSelect: Choose; unit?: string }) {
  const reduce = useReducedMotion(), maximum = Math.max(1, ...groups.map(item => item.count));
  if (!groups.length) return <Empty>No {unit} available for these accounts yet.</Empty>;
  return <div className="space-y-4 py-1">{groups.map(group => <Tooltip key={group.label} content={`${group.label} · ${number(group.count)} ${unit} · inspect accounts`} delay={150}><button type="button" aria-label={`${group.label}: ${group.count} ${unit}. Inspect accounts`} onClick={() => onSelect(group)} className={`group block w-full rounded-lg text-left ${focus}`}>
    <span className="mb-2.5 flex items-center justify-between gap-3 text-xs"><span className="truncate text-default-600">{group.label}</span><strong className="tabular-nums text-foreground">{number(group.count)}</strong></span>
    <span className="block h-5 overflow-hidden rounded-md bg-content2"><motion.span className="block h-full rounded-md opacity-85 group-hover:opacity-100" style={{ background: `linear-gradient(90deg, ${group.color}88, ${group.color})` }} initial={reduce ? false : { width: 0 }} animate={{ width: `${group.count / maximum * 100}%` }} transition={{ duration: reduce ? 0 : 0.65, ease: 'easeOut' }} /></span>
  </button></Tooltip>)}</div>;
}
function Columns({ groups, onSelect, unit = 'accounts' }: { groups: SecurityChartGroup[]; onSelect: Choose; unit?: string }) {
  const reduce = useReducedMotion();
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...groups.map(item => item.count)) / 4) * 4);
  if (!groups.length) return <Empty>No {unit} available yet.</Empty>;
  return <div className="relative mt-3 flex-1 pl-7">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44">{[0, 1, 2, 3, 4].map(i => <div key={i} className="absolute right-0 left-7 border-t border-dashed border-divider" style={{ top: `${i * 25}%` }}><span className="absolute -left-7 -top-2 text-[10px] tabular-nums text-default-500">{maximum - i * maximum / 4}</span></div>)}</div>
    <div className="relative flex gap-2">{groups.map(group => <Tooltip key={group.label} content={`${group.label}: ${number(group.count)} ${unit}`}><button type="button" onClick={() => onSelect(group)} aria-label={`${group.label}: ${group.count} ${unit}. Inspect accounts`} className={`group min-w-0 flex-1 rounded-lg ${focus}`}>
      <span className="relative flex h-44 items-end justify-center px-1 sm:px-2"><motion.span className="relative block w-full max-w-14 rounded-t-md opacity-90 group-hover:opacity-100" style={{ background: `linear-gradient(0deg, ${group.color}88, ${group.color})` }} initial={reduce ? false : { height: 0 }} animate={{ height: `${group.count / maximum * 100}%` }} transition={{ duration: reduce ? 0 : 0.65 }}><span className="absolute inset-x-0 -top-6 text-center text-xs font-semibold text-foreground">{group.count}</span></motion.span></span>
      <span className="mt-3 block min-h-9 break-words text-center text-[10px] leading-4 text-default-500">{group.label}</span>
    </button></Tooltip>)}</div>
  </div>;
}
function Composition({ groups, onSelect }: { groups: SecurityChartGroup[]; onSelect: Choose }) {
  const reduce = useReducedMotion(), total = groups.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <Empty>No device-location reports available.</Empty>;
  const saved = groups.find(item => item.label === 'Saved location')?.count || 0;
  return <><div className="mb-6 flex items-baseline gap-2"><strong className="text-4xl font-semibold tracking-tight text-foreground">{Math.round(saved / total * 100)}<span className="text-xl text-default-500">%</span></strong><span className="text-xs text-default-500">with a saved point</span></div><div className="mb-5 flex h-4 gap-1 overflow-hidden rounded-md" aria-label="Device location distribution">{groups.map(group => <Tooltip key={group.label} content={`${group.label}: ${group.count}`}><motion.button type="button" aria-label={`${group.label}: ${group.count} reports`} onClick={() => onSelect(group)} className={`h-full rounded-sm ${focus}`} style={{ background: group.color }} initial={reduce ? false : { width: 0 }} animate={{ width: `${group.count / total * 100}%` }} transition={{ duration: reduce ? 0 : 0.6 }} /></Tooltip>)}</div><Legend groups={groups} onSelect={onSelect} /></>;
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
    <div className="mb-3 grid max-w-md grid-cols-[1.3fr_1fr_0.8fr] items-end gap-3"><div><span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">{number(total)}</span><p className="mt-1 text-[11px] text-default-500">successful logins in period</p></div><div className="border-l border-divider pl-5"><strong className="text-lg font-medium text-foreground">{(total / data.days.length).toFixed(1)}</strong><p className="mt-1 text-[11px] text-default-500">daily average</p></div><div><strong className="text-lg font-medium text-primary">{peak}</strong><p className="mt-1 text-[11px] text-default-500">peak day</p></div></div>
    <div ref={container} className="relative mt-auto">
      {current && <div role="status" className="pointer-events-none absolute top-3 z-10 min-w-32 rounded-lg border border-divider bg-content2 px-3 py-2 shadow-xl" style={{ left: Math.min(width - 150, Math.max(0, current.x - 60)) }}><p className="text-[10px] text-default-500">{current.label} · UTC</p><p className="mt-1 text-xs font-semibold text-foreground">{current.count} logins</p><p className="mt-1 text-[10px] text-default-500">Click to inspect accounts</p></div>}
      <svg viewBox={`0 0 ${width} 260`} preserveAspectRatio="none" className="h-[260px] w-full touch-pan-y" role="img" aria-label="Daily successful logins. Use Daily data below for keyboard access." onPointerMove={e => setHovered(nearest(e))} onPointerLeave={() => setHovered(null)} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const i = Math.max(0, Math.min(points.length - 1, Math.round((((e.clientX - rect.left) / rect.width * width) - 42) / plotWidth * (points.length - 1)))); onSelect({ label: `Logins · ${points[i].label} UTC`, userIds: points[i].userIds }); }}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" /><stop offset="100%" stopColor="#fb923c" stopOpacity="0.015" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="42" x2={right} y1={224 - i * 46} y2={224 - i * 46} stroke="hsl(var(--heroui-divider))" strokeDasharray="4 5" /><text x="28" y={228 - i * 46} textAnchor="end" fill="hsl(var(--heroui-default-500))" fontSize="13">{maximum * i / 4}</text></g>)}
        <motion.path d={`${path} L ${right} 224 L 42 224 Z`} fill={`url(#${gradient})`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.5 }} />
        <motion.path key={points.length} d={path} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.9 }} />
        {points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.ceil((points.length - 1) / (width < 420 ? 2 : 4)) === 0).map(point => <text key={point.date} x={point.x} y="252" fill="hsl(var(--heroui-default-500))" fontSize="13" textAnchor="middle">{point.label}</text>)}
        {current && <g><line x1={current.x} x2={current.x} y1="35" y2="224" stroke="#fb923c77" strokeDasharray="4 4" /><circle cx={current.x} cy={current.y} r="6" fill="#fb923c" stroke="hsl(var(--heroui-content1))" strokeWidth="3" /></g>}
      </svg>
    </div>
    <details className="mt-3 text-xs"><summary className="w-fit cursor-pointer text-default-500 hover:text-primary">Daily data & account details</summary><div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-divider">{data.days.map((point, index) => <button key={point.date} type="button" onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} onClick={() => onSelect({ label: `Logins · ${point.label} UTC`, userIds: point.userIds })} className={`flex w-full justify-between px-3 py-2 text-default-600 hover:bg-content2 ${focus}`}><span>{point.label}</span><strong>{point.count}</strong></button>)}</div></details>
  </>;
}
function Heatmap({ data, onSelect }: { data: ChartData; onSelect: Choose }) {
  const maximum = Math.max(1, ...data.heatmap.flatMap(row => row.hours.map(hour => hour.count)));
  return <><div className="overflow-x-auto pb-2"><div className="min-w-[460px]"><div className="mb-3 grid gap-1 pl-9" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center text-[10px] text-default-500">{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>)}</div><div className="space-y-1.5">{data.heatmap.map(row => <div key={row.label} className="flex items-center gap-2"><span className="w-7 shrink-0 text-[10px] text-default-500">{row.label}</span><div className="grid flex-1 gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>{row.hours.map(hour => <Tooltip key={hour.label} content={`${hour.label} · ${hour.count} logins`} delay={100}><button type="button" aria-label={`${hour.label}: ${hour.count} successful logins`} onClick={() => onSelect(hour)} className={`h-5 rounded-[3px] border border-divider hover:ring-1 hover:ring-orange-200 ${focus}`} style={{ backgroundColor: hour.count ? `rgba(251, 146, 60, ${0.2 + hour.count / maximum * 0.8})` : 'hsl(var(--heroui-content2))' }} /></Tooltip>)}</div></div>)}</div></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-default-500"><span>UTC · each cell represents one hour<span className="mt-1 block sm:hidden">Swipe to see all 24 hours →</span></span><span className="flex items-center gap-1.5">Less {[0.05, 0.25, 0.5, 0.75, 1].map(opacity => <span key={opacity} className="h-2.5 w-2.5 rounded-sm" style={{ background: `rgba(251,146,60,${opacity})` }} />)} More</span></div></>;
}
type TopologyNode = { id: string; label: string; value: number; color: string; position: [number, number, number]; root?: boolean };
export function UserSecurityTopology({ users }: { users: SecurityUser[] }) {
  const mount = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [unsupported, setUnsupported] = useState(false);
  const [hovered, setHovered] = useState<TopologyNode | null>(null);
  const nodes = useMemo<TopologyNode[]>(() => {
    const devices = users.flatMap(user => user.devices?.length ? user.devices : [user.legacyNetwork || user.network].filter(Boolean));
    const sessions = users.flatMap(user => user.loginHistory || []);
    const networkReports = devices.filter(device => Boolean(device?.networkType && device.networkType !== 'none')).length;
    return [
      { id: 'root', label: 'Accounts', value: users.length, color: '#fb8500', position: [0, 0, 0], root: true },
      { id: 'devices', label: 'Devices', value: devices.length, color: '#38bdf8', position: [-3.1, 1.65, 0.3] },
      { id: 'sessions', label: 'Sessions', value: sessions.length, color: '#34d399', position: [-2.65, -1.75, 0.5] },
      { id: 'authorized', label: 'Authorized', value: sessions.filter(session => session.status === 'current').length, color: '#a78bfa', position: [0, -2.85, -0.4] },
      { id: 'networks', label: 'Networks', value: networkReports, color: '#fbbf24', position: [2.65, -1.75, 0.2] },
      { id: 'vpn', label: 'VPN detections', value: users.reduce((sum, user) => sum + (user.vpn?.count || 0), 0), color: '#fb7185', position: [3.1, 1.65, -0.2] },
      { id: 'locations', label: 'Saved locations', value: devices.filter(device => Boolean(device?.deviceLocation)).length, color: '#22d3ee', position: [0, 2.85, 0.45] },
    ];
  }, [users]);

  useEffect(() => {
    const target = mount.current;
    if (!target) return;
    let cancelled = false;
    let frame = 0;
    let cleanup: (() => void) | null = null;
    void Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]).then(([THREE, { OrbitControls }]) => {
      if (cancelled || !mount.current) return;
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0, 10.5);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.cursor = 'grab';
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.width = '100%';
        target.appendChild(renderer.domElement);

        const graph = new THREE.Group();
        scene.add(graph);
        const points = nodes.map(node => new THREE.Vector3(...node.position));
        const links: Array<[number, number]> = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 6], [2, 3], [4, 5]];
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.27 });
        links.forEach(([from, to]) => {
          const geometry = new THREE.BufferGeometry().setFromPoints([points[from], points[to]]);
          graph.add(new THREE.Line(geometry, edgeMaterial.clone()));
        });
        const movingNodes: Array<{ mesh: Three.Mesh; halo: Three.Mesh; phase: number }> = [];
        const nodeMeshes: Three.Mesh[] = [];
        nodes.forEach((node, index) => {
          const radius = node.root ? 0.46 : 0.27;
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.96 }));
          mesh.position.copy(points[index]);
          mesh.userData.topologyId = node.id;
          graph.add(mesh);
          nodeMeshes.push(mesh);
          const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.9, 20, 14), new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.08, depthWrite: false }));
          halo.position.copy(points[index]);
          graph.add(halo);
          movingNodes.push({ mesh, halo, phase: index * 0.7 });
        });
        const resize = () => {
          const width = Math.max(280, target.clientWidth);
          const height = Math.max(300, target.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(target);
        resize();
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = !reduce;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.minDistance = 6.2;
        controls.maxDistance = 16;
        controls.autoRotate = !reduce;
        controls.autoRotateSpeed = 0.55;
        controls.target.set(0, 0, 0);
        controls.update();
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let hoveredId = '';
        const handlePointerMove = (event: PointerEvent | null) => {
          if (!event) {
            hoveredId = '';
            setHovered(null);
            renderer.domElement.style.cursor = 'grab';
            return;
          }
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
          const nextId = typeof hit?.object.userData.topologyId === 'string' ? hit.object.userData.topologyId : '';
          if (nextId === hoveredId) return;
          hoveredId = nextId;
          setHovered(nodes.find(node => node.id === nextId) || null);
          renderer.domElement.style.cursor = nextId ? 'pointer' : 'grab';
        };
        const handlePointerLeave = () => handlePointerMove(null);
        renderer.domElement.addEventListener('pointermove', handlePointerMove);
        renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
        const clock = new THREE.Clock();
        const render = () => {
          if (cancelled) return;
          if (!reduce) {
            const elapsed = clock.getElapsedTime();
            movingNodes.forEach(({ mesh, halo, phase }) => {
              mesh.scale.setScalar(1 + Math.sin(elapsed * 1.35 + phase) * 0.045);
              halo.scale.setScalar(1 + Math.sin(elapsed * 1.1 + phase) * 0.08);
            });
          }
          controls.update();
          renderer.render(scene, camera);
          if (!reduce) frame = window.requestAnimationFrame(render);
        };
        controls.addEventListener('change', () => { if (reduce) renderer.render(scene, camera); });
        render();
        setUnsupported(false);
        cleanup = () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          controls.dispose();
          renderer.domElement.removeEventListener('pointermove', handlePointerMove);
          renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
          setHovered(null);
          scene.traverse(object => {
            const renderable = object as Three.Mesh;
            renderable.geometry?.dispose();
            if (Array.isArray(renderable.material)) renderable.material.forEach((material: Three.Material) => material.dispose());
            else renderable.material?.dispose();
          });
          renderer.dispose();
          if (renderer.domElement.parentNode === target) target.removeChild(renderer.domElement);
        };
      } catch {
        if (!cancelled) setUnsupported(true);
      }
    }).catch(() => { if (!cancelled) setUnsupported(true); });
    return () => { cancelled = true; cleanup?.(); };
  }, [nodes, reduce]);

  return <div className="space-y-4">
    <div ref={mount} role="img" aria-label="Three-dimensional user security network topology map" className="relative h-[380px] overflow-hidden rounded-2xl border border-white/[.08] bg-[radial-gradient(circle_at_50%_45%,rgba(251,133,0,.12),transparent_48%),#0c1119]"><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_15%,rgba(255,255,255,.025),transparent_80%)]" />{hovered && <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-[#151d28]/90 px-3 py-2 shadow-lg backdrop-blur"><p className="text-[10px] uppercase tracking-[.14em] text-slate-500">Selected signal</p><p className="mt-1 text-sm font-semibold text-white">{hovered.label}</p><p className="mt-0.5 text-xs tabular-nums text-orange-300">{number(hovered.value)} reported</p></div>}{unsupported && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs leading-6 text-slate-400">3D topology rendering is unavailable in this browser. The security metrics are still listed below.</div>}<div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[#111923]/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">Drag to rotate · scroll or pinch to zoom</div></div>
    <div className="grid gap-2 sm:grid-cols-3">{nodes.filter(node => !node.root).map(node => <div key={node.id} className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: node.color }} /><span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{node.label}</span><strong className="tabular-nums text-xs text-slate-200">{number(node.value)}</strong></div>)}</div>
    <p className="rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2.5 text-[11px] leading-5 text-slate-500">Aggregated topology only: the map shows relationships between reported account, device, session, network, VPN and location signals. It does not infer a user’s exact position or online presence.</p>
  </div>;
}
type AdvancedTopologyNode = TopologyNode & { deviceType: string; status: 'healthy' | 'watch' | 'critical' };
type AdvancedTopologyLink = { from: string; to: string; traffic: number; direction: 'in' | 'out'; status: 'normal' | 'watch' };
type DemoPacket = { id: string; source: string; destination: string; protocol: 'HTTPS' | 'TCP' | 'DNS' | 'UDP'; size: string; status: 'Delivered' | 'Inspecting' | 'Flagged' };
const topologyModes = [{ id: 'topology', label: 'Topology' }, { id: 'traffic', label: 'Live traffic' }, { id: 'packets', label: 'Packets' }, { id: 'bandwidth', label: 'Bandwidth' }, { id: 'threats', label: 'Threats' }] as const;
type TopologyMode = typeof topologyModes[number]['id'];

export function AdvancedUserSecurityTopology({ users }: { users: SecurityUser[] }) {
  const mount = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{ reset: () => void } | null>(null);
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<TopologyMode>('topology');
  const [unsupported, setUnsupported] = useState(false);
  const [hovered, setHovered] = useState<AdvancedTopologyNode | null>(null);
  const [selected, setSelected] = useState<AdvancedTopologyNode | null>(null);
  const topology = useMemo(() => {
    const devices = users.flatMap(user => user.devices?.length ? user.devices : [user.legacyNetwork || user.network].filter(Boolean));
    const sessions = users.flatMap(user => user.loginHistory || []);
    const vpnDetections = users.reduce((sum, user) => sum + (user.vpn?.count || 0), 0);
    const nodes: AdvancedTopologyNode[] = [
      { id: 'root', label: 'HappiNotes core', value: users.length, color: '#22d3ee', position: [0, 0, 0], root: true, deviceType: 'Core service', status: 'healthy' },
      { id: 'devices', label: 'Device fleet', value: devices.length, color: '#38bdf8', position: [-3.1, 1.55, 0.25], deviceType: 'Client devices', status: devices.length ? 'healthy' : 'watch' },
      { id: 'sessions', label: 'Sessions', value: sessions.length, color: '#34d399', position: [-2.75, -1.75, 0.5], deviceType: 'Authorization layer', status: sessions.length ? 'healthy' : 'watch' },
      { id: 'authorized', label: 'Authorized', value: sessions.filter(session => session.status === 'current').length, color: '#a78bfa', position: [0, -2.8, -0.4], deviceType: 'Active sessions', status: 'healthy' },
      { id: 'networks', label: 'Network edges', value: devices.filter(device => Boolean(device?.networkType && device.networkType !== 'none')).length, color: '#fbbf24', position: [2.75, -1.75, 0.2], deviceType: 'Reported networks', status: 'watch' },
      { id: 'vpn', label: 'VPN signals', value: vpnDetections, color: '#fb7185', position: [3.1, 1.55, -0.2], deviceType: 'Policy signals', status: vpnDetections ? 'critical' : 'healthy' },
      { id: 'locations', label: 'Location points', value: devices.filter(device => Boolean(device?.deviceLocation)).length, color: '#2dd4bf', position: [0, 2.8, 0.45], deviceType: 'Consent-based reports', status: 'healthy' },
    ];
    const links: AdvancedTopologyLink[] = [
      { from: 'root', to: 'devices', traffic: 72, direction: 'out', status: 'normal' },
      { from: 'root', to: 'sessions', traffic: 58, direction: 'out', status: 'normal' },
      { from: 'root', to: 'authorized', traffic: 46, direction: 'in', status: 'normal' },
      { from: 'root', to: 'networks', traffic: 64, direction: 'in', status: 'normal' },
      { from: 'root', to: 'vpn', traffic: Math.max(12, vpnDetections * 8), direction: 'in', status: vpnDetections ? 'watch' : 'normal' },
      { from: 'root', to: 'locations', traffic: 38, direction: 'in', status: 'normal' },
      { from: 'devices', to: 'locations', traffic: 31, direction: 'out', status: 'normal' },
      { from: 'sessions', to: 'authorized', traffic: 44, direction: 'out', status: 'normal' },
      { from: 'networks', to: 'vpn', traffic: Math.max(15, vpnDetections * 5), direction: 'out', status: vpnDetections ? 'watch' : 'normal' },
    ];
    const upload = Number((2.4 + devices.length * 0.55).toFixed(1));
    const download = Number((8.1 + sessions.length * 0.35).toFixed(1));
    return { nodes, links, stats: { devices: devices.length, sessions: sessions.length, vpnDetections, upload, download, latency: 16 + devices.length % 9, packetLoss: Number((0.08 + vpnDetections * 0.03).toFixed(2)) } };
  }, [users]);
  const packets = useMemo<DemoPacket[]>(() => [
    { id: 'pkt-001', source: 'Device fleet', destination: 'HappiNotes core', protocol: 'HTTPS', size: `${(1.3 + topology.stats.devices * 0.1).toFixed(1)} KB`, status: 'Delivered' },
    { id: 'pkt-002', source: 'Sessions', destination: 'Authorized', protocol: 'TCP', size: '842 B', status: 'Delivered' },
    { id: 'pkt-003', source: 'Network edges', destination: 'VPN signals', protocol: 'UDP', size: '2.6 KB', status: topology.stats.vpnDetections ? 'Flagged' : 'Inspecting' },
    { id: 'pkt-004', source: 'HappiNotes core', destination: 'Location points', protocol: 'HTTPS', size: '1.1 KB', status: 'Delivered' },
    { id: 'pkt-005', source: 'Device fleet', destination: 'Sessions', protocol: 'DNS', size: '418 B', status: 'Inspecting' },
  ], [topology.stats.devices, topology.stats.vpnDetections]);
  const bandwidth = useMemo(() => Array.from({ length: 18 }, (_, index) => Math.round((topology.stats.upload + topology.stats.download) * (0.7 + ((index * 7) % 11) / 32))), [topology.stats.download, topology.stats.upload]);

  useEffect(() => {
    const target = mount.current;
    if (!target) return;
    let cancelled = false;
    let frame = 0;
    let cleanup: (() => void) | null = null;
    void Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]).then(([THREE, { OrbitControls }]) => {
      if (cancelled || !mount.current) return;
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        camera.position.set(0, 0, 10.5);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.cursor = 'grab';
        target.appendChild(renderer.domElement);
        const graph = new THREE.Group();
        scene.add(graph);
        const pointMap = new Map(topology.nodes.map(node => [node.id, new THREE.Vector3(...node.position)]));
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1e9bc0, transparent: true, opacity: 0.32 });
        topology.links.forEach(link => {
          const from = pointMap.get(link.from), to = pointMap.get(link.to);
          if (!from || !to) return;
          const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
          const material = edgeMaterial.clone();
          material.color.set(link.status === 'watch' ? 0xfb7185 : link.direction === 'in' ? 0x38bdf8 : 0x22d3ee);
          material.opacity = link.status === 'watch' ? 0.58 : 0.32;
          graph.add(new THREE.Line(geometry, material));
        });
        const particles: Array<{ mesh: Three.Mesh; from: Three.Vector3; to: Three.Vector3; offset: number; speed: number }> = [];
        topology.links.forEach((link, linkIndex) => {
          const from = pointMap.get(link.from), to = pointMap.get(link.to);
          if (!from || !to) return;
          for (let particleIndex = 0; particleIndex < 2; particleIndex += 1) {
            const material = new THREE.MeshBasicMaterial({ color: link.status === 'watch' ? 0xfb7185 : 0x67e8f9 });
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), material);
            graph.add(mesh);
            particles.push({ mesh, from, to, offset: (particleIndex * 0.5 + linkIndex * 0.13) % 1, speed: 0.1 + link.traffic / 850 });
          }
        });
        const nodeMeshes: Three.Mesh[] = [];
        topology.nodes.forEach((node, index) => {
          const point = pointMap.get(node.id);
          if (!point) return;
          const radius = node.root ? 0.5 : 0.28;
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.96 }));
          mesh.position.copy(point);
          mesh.userData.topologyId = node.id;
          graph.add(mesh);
          nodeMeshes.push(mesh);
          const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.9, 20, 14), new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 0.1, depthWrite: false }));
          halo.position.copy(point);
          graph.add(halo);
          if (node.root) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 }));
            ring.position.copy(point);
            ring.rotation.x = Math.PI / 2;
            graph.add(ring);
          }
          void index;
        });
        const grid = new THREE.GridHelper(15, 18, 0x164e63, 0x0f2532);
        grid.position.y = -3.35;
        grid.material.transparent = true;
        grid.material.opacity = 0.24;
        scene.add(grid);
        const ambientPositions = new Float32Array(90);
        for (let index = 0; index < ambientPositions.length; index += 3) {
          const n = index / 3;
          ambientPositions[index] = ((n * 37) % 100) / 10 - 5;
          ambientPositions[index + 1] = ((n * 19) % 70) / 10 - 3.5;
          ambientPositions[index + 2] = ((n * 53) % 80) / 10 - 4;
        }
        const ambientGeometry = new THREE.BufferGeometry();
        ambientGeometry.setAttribute('position', new THREE.BufferAttribute(ambientPositions, 3));
        scene.add(new THREE.Points(ambientGeometry, new THREE.PointsMaterial({ color: 0x155e75, size: 0.035, transparent: true, opacity: 0.7 })));
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = !reduce;
        controls.dampingFactor = 0.08;
        controls.enablePan = true;
        controls.screenSpacePanning = true;
        controls.enableZoom = true;
        controls.minDistance = 5.8;
        controls.maxDistance = 18;
        controls.autoRotate = !reduce;
        controls.autoRotateSpeed = 0.55;
        controlsRef.current = controls;
        const resize = () => {
          const width = Math.max(320, target.clientWidth), height = Math.max(340, target.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(target);
        resize();
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let hoveredId = '';
        const hitNode = (event: MouseEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          return raycaster.intersectObjects(nodeMeshes, false)[0];
        };
        const handlePointerMove = (event: PointerEvent | null) => {
          if (!event) { hoveredId = ''; setHovered(null); renderer.domElement.style.cursor = 'grab'; return; }
          const hit = hitNode(event), nextId = typeof hit?.object.userData.topologyId === 'string' ? hit.object.userData.topologyId : '';
          if (nextId === hoveredId) return;
          hoveredId = nextId;
          setHovered(topology.nodes.find(node => node.id === nextId) || null);
          renderer.domElement.style.cursor = nextId ? 'pointer' : 'grab';
        };
        const handleClick = (event: PointerEvent) => {
          const hit = hitNode(event);
          const nodeId = typeof hit?.object.userData.topologyId === 'string' ? hit.object.userData.topologyId : '';
          setSelected(topology.nodes.find(node => node.id === nodeId) || null);
        };
        const handleDoubleClick = (event: MouseEvent) => {
          const hit = hitNode(event), nodeId = typeof hit?.object.userData.topologyId === 'string' ? hit.object.userData.topologyId : '';
          const point = pointMap.get(nodeId);
          if (point) { controls.target.copy(point); controls.update(); }
        };
        const handlePointerLeave = () => handlePointerMove(null);
        renderer.domElement.addEventListener('pointermove', handlePointerMove);
        renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
        renderer.domElement.addEventListener('click', handleClick);
        renderer.domElement.addEventListener('dblclick', handleDoubleClick);
        const clock = new THREE.Clock();
        const render = () => {
          if (cancelled) return;
          const elapsed = clock.getElapsedTime();
          particles.forEach(particle => {
            const progress = (elapsed * particle.speed + particle.offset) % 1;
            particle.mesh.position.lerpVectors(particle.from, particle.to, progress);
          });
          topology.nodes.forEach((node, index) => { const mesh = nodeMeshes[index]; if (mesh) mesh.scale.setScalar(1 + Math.sin(elapsed * 1.2 + index) * 0.035); });
          controls.update();
          renderer.render(scene, camera);
          if (!reduce) frame = window.requestAnimationFrame(render);
        };
        const renderOnChange = () => { if (reduce) renderer.render(scene, camera); };
        controls.addEventListener('change', renderOnChange);
        render();
        setUnsupported(false);
        cleanup = () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          controls.removeEventListener('change', renderOnChange);
          controls.dispose();
          controlsRef.current = null;
          renderer.domElement.removeEventListener('pointermove', handlePointerMove);
          renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
          renderer.domElement.removeEventListener('click', handleClick);
          renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
          scene.traverse(object => {
            const renderable = object as Three.Mesh;
            renderable.geometry?.dispose();
            if (Array.isArray(renderable.material)) renderable.material.forEach((material: Three.Material) => material.dispose());
            else renderable.material?.dispose();
          });
          renderer.dispose();
          if (renderer.domElement.parentNode === target) target.removeChild(renderer.domElement);
        };
      } catch { if (!cancelled) setUnsupported(true); }
    }).catch(() => { if (!cancelled) setUnsupported(true); });
    return () => { cancelled = true; cleanup?.(); };
  }, [reduce, topology]);

  const resetCamera = () => { controlsRef.current?.reset(); setSelected(null); setHovered(null); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">NOC telemetry · DEMO DATA</p><h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-100">Network Topology Map</h2><p className="mt-1 text-xs text-slate-400">Interactive 3D relationships from the current security snapshot.</p></div><div className="flex items-center gap-2"><span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Simulation active</span><Button size="sm" variant="bordered" onPress={resetCamera}>Reset view</Button></div></div>
    <div role="tablist" aria-label="Network monitoring views" className="flex w-full gap-1 overflow-x-auto rounded-xl border border-white/[.08] bg-[#0b1119] p-1">{topologyModes.map(item => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} onClick={() => setMode(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${mode === item.id ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-500 hover:bg-white/[.04] hover:text-slate-200'}`}>{item.label}</button>)}</div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_265px]">
      <div ref={mount} role="img" aria-label="Interactive three-dimensional user security network topology map" className="relative h-[440px] overflow-hidden rounded-2xl border border-cyan-300/10 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.13),transparent_44%),#05070d]"><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_15%,rgba(34,211,238,.03),transparent_80%)]" />{hovered && <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-cyan-200/15 bg-[#07121b]/90 px-3 py-2 shadow-lg backdrop-blur"><p className="text-[9px] uppercase tracking-[.15em] text-slate-500">Selected signal</p><p className="mt-1 text-sm font-semibold text-white">{hovered.label}</p><p className="mt-0.5 text-xs tabular-nums text-cyan-200">{number(hovered.value)} reported</p></div>}{unsupported && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs leading-6 text-slate-400">3D topology rendering is unavailable in this browser. The security metrics are still listed below.</div>}<div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-[#07121b]/85 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">Drag to rotate · scroll or pinch to zoom · double-click to focus</div></div>
      <aside className="rounded-2xl border border-white/[.08] bg-[#0b1119] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Device details</p><span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[9px] font-semibold text-cyan-200">LIVE</span></div>{selected ? <div className="mt-5 space-y-4"><div><p className="text-lg font-semibold text-slate-100">{selected.label}</p><p className="mt-1 text-xs text-slate-500">{selected.deviceType}</p></div><div className="space-y-2 text-xs"><div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className={selected.status === 'critical' ? 'text-rose-300' : selected.status === 'watch' ? 'text-amber-300' : 'text-emerald-300'}>{selected.status}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Reports</span><strong className="tabular-nums text-slate-200">{number(selected.value)}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-500">Signal ID</span><span className="font-mono text-[10px] text-slate-400">{selected.id}</span></div></div><Button size="sm" variant="flat" color="primary" fullWidth onPress={resetCamera}>Reset focus</Button></div> : <div className="flex min-h-52 flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[.06] text-cyan-200">⌁</div><p className="mt-4 text-sm font-medium text-slate-200">Select a node</p><p className="mt-1 max-w-44 text-xs leading-5 text-slate-500">Click a node to inspect its signal. Double-click to center the camera.</p></div>}</aside>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[{ label: 'Active links', value: topology.links.length, accent: '#22d3ee' }, { label: 'Upload', value: `${topology.stats.upload} Mbps`, accent: '#a78bfa' }, { label: 'Download', value: `${topology.stats.download} Mbps`, accent: '#38bdf8' }, { label: 'Latency', value: `${topology.stats.latency} ms`, accent: '#34d399' }].map(metric => <div key={metric.label} className="rounded-xl border border-white/[.07] bg-[#0b1119] px-3 py-3"><p className="text-[10px] text-slate-500">{metric.label}</p><p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: metric.accent }}>{metric.value}</p></div>)}</div>
    {mode === 'traffic' && <section className="rounded-2xl border border-white/[.08] bg-[#0b1119] p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-100">Live Network Traffic Flow</h3><p className="mt-1 text-xs text-slate-500">Animated particles represent simulated packet direction and intensity.</p></div><span className="text-[10px] text-slate-500">DEMO DATA</span></div><div className="mt-4 space-y-2">{topology.links.map(link => <div key={`${link.from}-${link.to}`} className="flex items-center gap-3 rounded-lg border border-white/[.05] px-3 py-2 text-xs"><span className={`h-2 w-2 rounded-full ${link.status === 'watch' ? 'bg-rose-400' : 'bg-cyan-300'}`} /><span className="min-w-0 flex-1 truncate text-slate-300">{link.from} <span className="text-slate-600">→</span> {link.to}</span><span className="text-slate-500">{link.direction === 'in' ? 'IN' : 'OUT'}</span><strong className="tabular-nums text-cyan-200">{link.traffic} pkt/s</strong></div>)}</div></section>}
    {mode === 'packets' && <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0b1119]"><div className="flex items-center justify-between border-b border-white/[.07] px-4 py-4"><div><h3 className="text-sm font-semibold text-slate-100">Packet Inspector</h3><p className="mt-1 text-xs text-slate-500">Simulated packet stream prepared for future telemetry.</p></div><span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[9px] font-semibold text-cyan-200">DEMO DATA</span></div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.12em] text-slate-500"><tr>{['Packet', 'Source', 'Destination', 'Protocol', 'Size', 'Status'].map(header => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{packets.map(packet => <tr key={packet.id} className="border-t border-white/[.05] text-slate-300"><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{packet.id}</td><td className="px-4 py-3">{packet.source}</td><td className="px-4 py-3">{packet.destination}</td><td className="px-4 py-3 font-mono text-cyan-200">{packet.protocol}</td><td className="px-4 py-3 tabular-nums">{packet.size}</td><td className={`px-4 py-3 ${packet.status === 'Flagged' ? 'text-rose-300' : packet.status === 'Inspecting' ? 'text-amber-300' : 'text-emerald-300'}`}>{packet.status}</td></tr>)}</tbody></table></div></section>}
    {mode === 'bandwidth' && <section className="rounded-2xl border border-white/[.08] bg-[#0b1119] p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-100">Bandwidth Monitoring</h3><p className="mt-1 text-xs text-slate-500">Throughput trend · simulated values ready for WebSocket telemetry.</p></div><div className="text-right text-xs"><p className="text-slate-500">Packet loss</p><strong className="text-amber-200">{topology.stats.packetLoss}%</strong></div></div><svg viewBox="0 0 720 190" className="mt-5 h-48 w-full" role="img" aria-label="Simulated bandwidth monitoring chart"><defs><linearGradient id="security-bandwidth-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity=".35" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs><path d={`${bandwidth.map((value, index) => `${index ? 'L' : 'M'} ${index / (bandwidth.length - 1) * 680 + 20} ${165 - value / Math.max(...bandwidth) * 130}`).join(' ')} L700 165 L20 165 Z`} fill="url(#security-bandwidth-fill)" /><path d={bandwidth.map((value, index) => `${index ? 'L' : 'M'} ${index / (bandwidth.length - 1) * 680 + 20} ${165 - value / Math.max(...bandwidth) * 130}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" /><line x1="20" x2="700" y1="165" y2="165" stroke="#ffffff14" /><text x="20" y="184" fill="#64748b" fontSize="10">-18 min</text><text x="680" y="184" fill="#64748b" fontSize="10" textAnchor="end">now</text></svg></section>}
    {mode === 'threats' && <section className="rounded-2xl border border-rose-300/10 bg-[#0b1119] p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-100">Threat & Anomaly Monitoring</h3><p className="mt-1 text-xs text-slate-500">Visual policy signals only; no real threat engine is connected.</p></div><span className="rounded-full bg-rose-400/10 px-2 py-1 text-[9px] font-semibold text-rose-300">SIMULATED</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] text-slate-500">VPN signals</p><p className="mt-1 text-xl font-semibold text-rose-300">{topology.stats.vpnDetections}</p></div><div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] text-slate-500">Packet loss</p><p className="mt-1 text-xl font-semibold text-amber-200">{topology.stats.packetLoss}%</p></div><div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] text-slate-500">Risk state</p><p className="mt-1 text-xl font-semibold text-emerald-300">{topology.stats.vpnDetections ? 'Review' : 'Nominal'}</p></div></div></section>}
    <p className="rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2.5 text-[11px] leading-5 text-slate-500">This view combines the current security snapshot with clearly marked demo telemetry. It does not infer exact location, online presence or malicious activity. Replace the simulator with a server WebSocket stream when live network telemetry is available.</p>
  </div>;
}
type PacketRow = DemoPacket & { timestamp: string; port: string; direction: 'IN' | 'OUT' };
const packetProtocols: Array<'All' | DemoPacket['protocol']> = ['All', 'HTTPS', 'TCP', 'DNS', 'UDP'];
export function PacketLevelVisualization({ users }: { users: SecurityUser[] }) {
  const [query, setQuery] = useState('');
  const [protocol, setProtocol] = useState<'All' | DemoPacket['protocol']>('All');
  const [sort, setSort] = useState<'timestamp' | 'protocol' | 'status'>('timestamp');
  const [page, setPage] = useState(1);
  const packets = useMemo<PacketRow[]>(() => {
    const deviceNames = users.map((user, index) => user.network?.deviceModel || user.devices?.[0]?.deviceModel || `Device ${String(index + 1).padStart(2, '0')}`);
    const count = Math.max(8, Math.min(18, deviceNames.length * 2 + 4));
    const protocols: DemoPacket['protocol'][] = ['HTTPS', 'TCP', 'DNS', 'UDP'];
    const destinations = ['HappiNotes core', 'Session gateway', 'Media service', 'Location service'];
    return Array.from({ length: count }, (_, index) => {
      const packetProtocol = protocols[index % protocols.length];
      const flagged = index === 2 && users.some(user => (user.vpn?.count || 0) > 0);
      return { id: `pkt-${String(index + 1).padStart(3, '0')}`, source: deviceNames[index % Math.max(1, deviceNames.length)], destination: destinations[index % destinations.length], protocol: packetProtocol, port: packetProtocol === 'HTTPS' ? '443' : packetProtocol === 'DNS' ? '53' : packetProtocol === 'UDP' ? '3478' : '8080', size: `${(0.6 + (index * 0.37) % 3).toFixed(1)} KB`, timestamp: `T+00:${String(index * 3).padStart(2, '0')}`, direction: index % 2 ? 'OUT' : 'IN', status: flagged ? 'Flagged' : index % 3 === 0 ? 'Inspecting' : 'Delivered' };
    });
  }, [users]);
  const filtered = useMemo(() => packets.filter(packet => (protocol === 'All' || packet.protocol === protocol) && `${packet.id} ${packet.source} ${packet.destination} ${packet.protocol}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === 'protocol' ? a.protocol.localeCompare(b.protocol) : sort === 'status' ? a.status.localeCompare(b.status) : a.timestamp.localeCompare(b.timestamp)), [packets, protocol, query, sort]);
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visiblePackets = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const protocolCounts = packetProtocols.slice(1).map(item => ({ label: item, count: packets.filter(packet => packet.protocol === item).length }));
  const flagged = packets.filter(packet => packet.status === 'Flagged').length;
  const stats = [{ label: 'Packets observed', value: packets.length, color: '#22d3ee' }, { label: 'Inbound', value: packets.filter(packet => packet.direction === 'IN').length, color: '#38bdf8' }, { label: 'Outbound', value: packets.filter(packet => packet.direction === 'OUT').length, color: '#a78bfa' }, { label: 'Flagged', value: flagged, color: flagged ? '#fb7185' : '#34d399' }];
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(stat => <div key={stat.label} className="rounded-2xl border border-white/[.08] bg-[#0b1119] p-4"><p className="text-[10px] text-slate-500">{stat.label}</p><p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: stat.color }}>{number(stat.value)}</p><p className="mt-1 text-[10px] text-slate-600">DEMO DATA</p></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <section className="overflow-hidden rounded-2xl border border-cyan-300/10 bg-[radial-gradient(circle_at_20%_50%,rgba(34,211,238,.13),transparent_48%),#05070d] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">Packet stream</p><h3 className="mt-1 text-sm font-semibold text-slate-100">Live connection flow</h3></div><span className="flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Simulation active</span></div><div className="relative mt-4 h-24 overflow-hidden rounded-xl border border-white/[.06] bg-[#07121b]"><div className="absolute left-[6%] right-[6%] top-1/2 h-px bg-gradient-to-r from-cyan-300/10 via-cyan-300/70 to-purple-300/20" />{Array.from({ length: 9 }, (_, index) => <motion.span key={index} className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_14px_#22d3ee]" initial={{ left: '6%', opacity: 0 }} animate={{ left: ['6%', '94%'], opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }} transition={{ duration: 2.5, delay: index * 0.27, repeat: Infinity, ease: 'linear' }} />)}<span className="absolute left-3 top-3 text-[9px] uppercase tracking-[.12em] text-slate-600">Client devices</span><span className="absolute right-3 top-3 text-[9px] uppercase tracking-[.12em] text-slate-600">HappiNotes core</span><span className="absolute bottom-3 left-3 text-[10px] text-slate-500">IN {number(stats[1].value)} · OUT {number(stats[2].value)}</span><span className="absolute bottom-3 right-3 text-[10px] text-cyan-200">{number(packets.length)} packets</span></div></section>
      <section className="rounded-2xl border border-white/[.08] bg-[#0b1119] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Protocol mix</p><div className="mt-4 space-y-3">{protocolCounts.map(item => <div key={item.label}><div className="mb-1 flex justify-between text-xs"><span className="font-mono text-slate-300">{item.label}</span><strong className="tabular-nums text-slate-200">{item.count}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]"><motion.div initial={{ width: 0 }} animate={{ width: `${item.count / Math.max(1, packets.length) * 100}%` }} transition={{ duration: .5 }} className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" /></div></div>)}</div><p className="mt-5 text-[10px] leading-4 text-slate-600">Protocol values are simulated until a packet telemetry source is connected.</p></section>
    </div>
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0b1119]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] p-4"><div><h3 className="text-sm font-semibold text-slate-100">Packet inspector</h3><p className="mt-1 text-xs text-slate-500">Filter, search and sort the simulated packet stream.</p></div><span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[9px] font-semibold text-cyan-200">DEMO DATA</span></div><div className="flex flex-wrap items-center gap-2 border-b border-white/[.07] p-3"><input aria-label="Search packets" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search packets" className="h-9 min-w-48 flex-1 rounded-lg border border-white/10 bg-white/[.03] px-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/50" />{packetProtocols.map(item => <button key={item} type="button" onClick={() => { setProtocol(item); setPage(1); }} className={`rounded-lg px-2.5 py-2 text-[11px] font-medium ${protocol === item ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-500 hover:bg-white/[.04] hover:text-slate-200'}`}>{item}</button>)}<Button size="sm" variant="flat" onPress={() => setSort(sort === 'timestamp' ? 'protocol' : sort === 'protocol' ? 'status' : 'timestamp')}>Sort: {sort}</Button></div><div className="overflow-x-auto"><table className="min-w-[800px] w-full text-left text-xs"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.12em] text-slate-500"><tr>{['Packet', 'Timestamp', 'Source', 'Destination', 'Protocol', 'Port', 'Size', 'Status'].map(header => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{visiblePackets.map(packet => <tr key={packet.id} className="border-t border-white/[.05] text-slate-300"><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{packet.id}</td><td className="px-4 py-3 font-mono text-[10px] text-slate-500">{packet.timestamp}</td><td className="max-w-36 truncate px-4 py-3">{packet.source}</td><td className="px-4 py-3">{packet.destination}</td><td className="px-4 py-3 font-mono text-cyan-200">{packet.protocol}</td><td className="px-4 py-3 font-mono text-slate-400">:{packet.port}</td><td className="px-4 py-3 tabular-nums">{packet.size}</td><td className={`px-4 py-3 ${packet.status === 'Flagged' ? 'text-rose-300' : packet.status === 'Inspecting' ? 'text-amber-300' : 'text-emerald-300'}`}>{packet.status}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] p-3"><span className="text-[11px] text-slate-500">{filtered.length} matching packets · page {currentPage} of {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="flat" isDisabled={currentPage <= 1} onPress={() => setPage(value => Math.max(1, value - 1))}>Previous</Button><Button size="sm" variant="flat" isDisabled={currentPage >= totalPages} onPress={() => setPage(value => Math.min(totalPages, value + 1))}>Next</Button></div></div></section>
  </div>;
}
export type PacketTelemetryPacket = { timestamp: string; sourceIp: string; destinationIp: string; protocol: string; sourcePort: number | null; destinationPort: number | null; sizeBytes: number | null };
export type PacketTelemetrySnapshot = { enabled: boolean; available: boolean; capturedAt: string; interface: string; durationSeconds: number; packets: PacketTelemetryPacket[]; reason?: string };
export function RealPacketLevelVisualization({ users, telemetry }: { users: SecurityUser[]; telemetry: PacketTelemetrySnapshot | null }) {
  const reduce = useReducedMotion();
  const [ipPage, setIpPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const pageSize = 10;
  const snapshot = useMemo(() => {
    const devices = users.flatMap(user => user.devices?.length ? user.devices : [user.legacyNetwork || user.network].filter(Boolean));
    const sessions = users.flatMap(user => (user.loginHistory || []).map(session => ({ user, session })));
    const ipObservations = [
      ...devices.flatMap(device => device?.publicIp ? [{ account: '', ip: device.publicIp, source: 'Device report', seenAt: device.lastSeen || device.firstSeen || '', network: device.networkType || 'Unknown' }] : []),
      ...sessions.flatMap(({ user, session }) => session.publicIp ? [{ account: user.name, ip: session.publicIp, source: 'Login session', seenAt: session.lastSeen || session.startedAt, network: session.os || 'Session' }] : []),
    ];
    const signals = [
      { label: 'Accounts in view', value: users.length, color: '#22d3ee' },
      { label: 'Device network reports', value: devices.length, color: '#38bdf8' },
      { label: 'Public IP observations', value: ipObservations.length, color: '#67e8f9' },
      { label: 'Packet records', value: telemetry?.packets.length || 0, color: '#22d3ee' },
      { label: 'Successful sessions', value: sessions.length, color: '#34d399' },
      { label: 'Authorized sessions', value: sessions.filter(({ session }) => session.status === 'current').length, color: '#a78bfa' },
      { label: 'VPN detection events', value: users.reduce((sum, user) => sum + (user.vpn?.count || 0), 0), color: '#fb7185' },
      { label: 'Saved device locations', value: devices.filter(device => Boolean(device?.deviceLocation)).length, color: '#2dd4bf' },
    ];
    const recentSessions = sessions.sort((a, b) => Date.parse(b.session.startedAt) - Date.parse(a.session.startedAt)).slice(0, 50);
    return { devices, sessions, signals, recentSessions, ipObservations };
  }, [telemetry?.packets.length, users]);
  const maximum = Math.max(1, ...snapshot.signals.map(signal => signal.value));
  const formatDate = (value: string) => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : 'Unavailable'; };
  const packetProtocolCounts = [...new Set((telemetry?.packets || []).map(packet => packet.protocol))].map(protocol => ({ protocol, count: telemetry?.packets.filter(packet => packet.protocol === protocol).length || 0 }));
  const capturedPackets = Boolean(telemetry?.available && telemetry.packets.length);
  const ipFallback = !capturedPackets && snapshot.ipObservations.length > 0;
  const ipTotalPages = Math.max(1, Math.ceil(snapshot.ipObservations.length / pageSize));
  const sessionTotalPages = Math.max(1, Math.ceil(snapshot.recentSessions.length / pageSize));
  const currentIpPage = Math.min(ipPage, ipTotalPages);
  const currentSessionPage = Math.min(sessionPage, sessionTotalPages);
  const visibleIpObservations = snapshot.ipObservations.slice((currentIpPage - 1) * pageSize, currentIpPage * pageSize);
  const visibleSessions = snapshot.recentSessions.slice((currentSessionPage - 1) * pageSize, currentSessionPage * pageSize);
  const packetReason = telemetry?.reason === 'disabled' ? 'Packet capture is disabled on the backend.' : telemetry?.reason === 'capture_tools_unavailable' ? 'TShark or Dumpcap is not installed on the backend.' : telemetry?.reason === 'capture_failed' ? 'Dumpcap could not start a capture on the configured interface.' : telemetry?.reason === 'decoder_failed' ? 'TShark could not decode the temporary capture.' : 'No packets were captured during the bounded sample window.';
  return <div className="space-y-5">
    <section className={`rounded-2xl p-5 ${capturedPackets ? 'border border-emerald-300/15 bg-emerald-300/[.04]' : ipFallback ? 'border border-cyan-300/15 bg-cyan-300/[.04]' : 'border border-amber-300/15 bg-amber-300/[.04]'}`}><div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${capturedPackets ? 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-800 dark:text-emerald-200' : ipFallback ? 'border border-cyan-300/20 bg-cyan-300/10 text-cyan-800 dark:text-cyan-200' : 'border border-amber-300/20 bg-amber-300/10 text-amber-800 dark:text-amber-200'}`}>{capturedPackets ? '✓' : ipFallback ? 'i' : '!'}</span><div><h2 className="text-sm font-semibold text-foreground">{capturedPackets ? `${number(telemetry?.packets.length || 0)} packet records captured` : ipFallback ? `${number(snapshot.ipObservations.length)} existing IP observations available` : 'No packet telemetry available'}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-default-500">{capturedPackets ? `Metadata-only capture from ${telemetry?.interface} at ${formatDate(telemetry?.capturedAt || '')}. Packet payloads are not returned or stored.` : ipFallback ? 'TShark/Dumpcap has not returned a packet sample, so this view uses the existing server-observed IP and login records. IP records cannot reconstruct packet contents.' : `${packetReason} The backend returns no fabricated packets.`}</p></div></div></section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-2xl border border-divider bg-content1 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-800 dark:text-cyan-300">Connected data</p><h3 className="mt-1 text-sm font-semibold text-foreground">Real security signals</h3></div><span className="text-[10px] text-default-500">Current page</span></div><div className="mt-5 space-y-4">{snapshot.signals.map(signal => <div key={signal.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-default-500">{signal.label}</span><strong className="tabular-nums text-foreground">{number(signal.value)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-content2"><motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${signal.value / maximum * 100}%` }} transition={{ duration: reduce ? 0 : .55 }} className="h-full rounded-full" style={{ background: signal.color }} /></div></div>)}</div></section>
      <section className="rounded-2xl border border-divider bg-content1 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-default-500">Telemetry status</p><div className="mt-5 space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-default-500">Packet source</span><span className={capturedPackets ? 'text-emerald-800 dark:text-emerald-300' : ipFallback ? 'text-cyan-800 dark:text-cyan-200' : 'text-amber-800 dark:text-amber-200'}>{capturedPackets ? 'TShark / Dumpcap' : ipFallback ? 'Existing IP records' : 'Unavailable'}</span></div><div className="flex items-center justify-between"><span className="text-default-500">Network reports</span><span className={snapshot.devices.length ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200'}>{snapshot.devices.length ? 'Available' : 'No reports'}</span></div><div className="flex items-center justify-between"><span className="text-default-500">Session history</span><span className={snapshot.sessions.length ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-200'}>{snapshot.sessions.length ? 'Available' : 'No records'}</span></div><div className="flex items-center justify-between"><span className="text-default-500">VPN events</span><span className={users.some(user => (user.vpn?.count || 0) > 0) ? 'text-emerald-800 dark:text-emerald-300' : 'text-default-500'}>{users.some(user => (user.vpn?.count || 0) > 0) ? 'Available' : 'No events'}</span></div></div><p className="mt-5 text-[11px] leading-5 text-default-500">Only metadata returned by the authenticated backend is displayed.</p></section>
    </div>
    {telemetry?.available && telemetry.packets.length > 0 && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="overflow-hidden rounded-2xl border border-divider bg-content1"><div className="border-b border-divider px-5 py-4"><h3 className="text-sm font-semibold text-foreground">Captured packet metadata</h3><p className="mt-1 text-xs text-default-500">Bounded, in-memory sample. No payload bytes are exposed.</p></div><div className="overflow-x-auto"><table className="min-w-[820px] w-full text-left text-xs"><thead className="bg-content2 text-[10px] uppercase tracking-[.12em] text-default-500"><tr>{['Timestamp', 'Source IP', 'Destination IP', 'Protocol', 'Ports', 'Size'].map(header => <th key={header} className="px-5 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{telemetry.packets.map((packet, index) => <tr key={`${packet.timestamp}-${index}`} className="border-t border-divider text-default-600"><td className="px-5 py-3 text-default-500">{formatDate(packet.timestamp)}</td><td className="px-5 py-3 font-mono text-[10px]">{packet.sourceIp || 'Not reported'}</td><td className="px-5 py-3 font-mono text-[10px]">{packet.destinationIp || 'Not reported'}</td><td className="px-5 py-3 font-mono text-cyan-800 dark:text-cyan-200">{packet.protocol}</td><td className="px-5 py-3 font-mono text-[10px] text-default-500">{packet.sourcePort ?? '—'} → {packet.destinationPort ?? '—'}</td><td className="px-5 py-3 tabular-nums">{packet.sizeBytes == null ? '—' : `${number(packet.sizeBytes)} B`}</td></tr>)}</tbody></table></div></div><section className="rounded-2xl border border-divider bg-content1 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-default-500">Protocols</p><div className="mt-5 space-y-3">{packetProtocolCounts.map(item => <div key={item.protocol}><div className="mb-1 flex justify-between text-xs"><span className="font-mono text-default-600">{item.protocol}</span><strong className="tabular-nums text-cyan-800 dark:text-cyan-200">{item.count}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-content2"><motion.div initial={reduce ? false : { width: 0 }} animate={{ width: `${item.count / Math.max(1, telemetry.packets.length) * 100}%` }} transition={{ duration: reduce ? 0 : .45 }} className="h-full rounded-full bg-cyan-300" /></div></div>)}</div></section></section>}
    {!capturedPackets && snapshot.ipObservations.length > 0 && <Accordion variant="bordered" className="rounded-2xl border border-cyan-300/10 bg-content1 px-1" itemClasses={{ base: 'border-b-0', trigger: 'px-4 py-4', title: 'text-sm font-semibold text-foreground', subtitle: 'text-xs text-default-500', content: 'px-0 pb-2' }}>
      <AccordionItem key="ip-observations" aria-label="Existing IP observations" title="Existing IP observations" subtitle={`${number(snapshot.ipObservations.length)} real public IP observations · not packet capture`} startContent={<span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-800 dark:text-cyan-200" aria-hidden="true">⌁</span>}>
        <div className="overflow-x-auto"><table className="min-w-[650px] w-full text-left text-xs"><thead className="bg-content2 text-[10px] uppercase tracking-[.12em] text-default-500"><tr>{['Account', 'Public IP', 'Source', 'Network', 'Last seen'].map(header => <th key={header} className="px-5 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{visibleIpObservations.map((observation, index) => <tr key={`${observation.ip}-${observation.seenAt}-${index}`} className="border-t border-divider text-default-600"><td className="px-5 py-3">{observation.account || 'Device report'}</td><td className="px-5 py-3 font-mono text-[10px] text-cyan-800 dark:text-cyan-200">{observation.ip}</td><td className="px-5 py-3 text-default-500">{observation.source}</td><td className="px-5 py-3 capitalize text-default-500">{observation.network}</td><td className="px-5 py-3 text-default-500">{formatDate(observation.seenAt)}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3"><span className="text-[11px] text-default-500">Page {currentIpPage} of {ipTotalPages} · {number(snapshot.ipObservations.length)} observations</span>{ipTotalPages > 1 && <Pagination aria-label="Existing IP observations pagination" page={currentIpPage} total={ipTotalPages} onChange={setIpPage} isCompact size="sm" radius="lg" color="primary" siblings={0} boundaries={1} />}</div>
      </AccordionItem>
    </Accordion>}
    <Accordion variant="bordered" className="rounded-2xl border border-divider bg-content1 px-1" itemClasses={{ base: 'border-b-0', trigger: 'px-4 py-4', title: 'text-sm font-semibold text-foreground', subtitle: 'text-xs text-default-500', content: 'px-0 pb-2' }}>
      <AccordionItem key="session-records" aria-label="Recent real session records" title="Recent real session records" subtitle={`${number(snapshot.recentSessions.length)} login/session records · not fabricated packets`} startContent={<span className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-800 dark:text-emerald-200" aria-hidden="true">↗</span>}>
        <div className="overflow-x-auto">{snapshot.recentSessions.length ? <table className="min-w-[850px] w-full text-left text-xs"><thead className="bg-content2 text-[10px] uppercase tracking-[.12em] text-default-500"><tr>{['Account', 'Started', 'Status', 'Device', 'Public IP'].map(header => <th key={header} className="px-5 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{visibleSessions.map(({ user, session }) => <tr key={`${user.id}-${session.id}`} className="border-t border-divider text-default-600"><td className="px-5 py-3"><span className="block font-medium text-foreground">{user.name}</span><span className="mt-0.5 block text-[10px] text-default-500">{user.email || 'No email'}</span></td><td className="px-5 py-3 text-default-500">{formatDate(session.startedAt)}</td><td className="px-5 py-3 capitalize text-default-500">{session.status.replaceAll('_', ' ')}</td><td className="px-5 py-3 text-default-500">{session.deviceModel || 'Not reported'}</td><td className="px-5 py-3 font-mono text-[10px] text-default-500">{session.publicIp || 'Not reported'}</td></tr>)}</tbody></table> : <p className="p-8 text-center text-xs text-default-500">No session records were returned for the current page.</p>}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3"><span className="text-[11px] text-default-500">Page {currentSessionPage} of {sessionTotalPages} · {number(snapshot.recentSessions.length)} records</span>{sessionTotalPages > 1 && <Pagination aria-label="Recent session records pagination" page={currentSessionPage} total={sessionTotalPages} onChange={setSessionPage} isCompact size="sm" radius="lg" color="primary" siblings={0} boundaries={1} />}</div>
      </AccordionItem>
    </Accordion>
  </div>;
}
export function SecurityChartsLoading() {
  return <div role="status" aria-label="Loading security charts" aria-busy="true" className="space-y-5"><span className="sr-only">Loading security charts</span><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl motion-reduce:before:animate-none" />)}</div><div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className={`rounded-2xl border border-divider bg-content1 p-6 ${i === 0 ? 'lg:col-span-2' : ''}`}><Skeleton className="mb-8 h-4 w-40 rounded motion-reduce:before:animate-none" /><div className="flex h-56 items-end gap-4">{[40, 70, 50, 90, 65, 80].map((height, j) => <Skeleton key={j} style={{ height: `${height}%` }} className="flex-1 rounded-t-lg motion-reduce:before:animate-none" />)}</div></div>)}</div></div>;
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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map((metric, i) => <motion.div key={metric.label} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.04 }} className="relative overflow-hidden rounded-2xl border border-divider bg-content1 p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs text-default-500">{metric.label}</p><span className="hidden rounded-lg p-2 sm:block" style={{ color: metric.color, background: `${metric.color}12` }}><Icon type={metric.icon} /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">{number(metric.value)}</p><p className="mt-2 text-[10px] leading-4 text-default-500">{metric.note}</p><span className="absolute bottom-0 left-5 h-px w-10" style={{ background: metric.color }} /></motion.div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-foreground">Access & activity</h2><p className="mt-1 text-xs text-default-500">Explore sign-ins and the current account snapshot.</p></div><div className="flex items-center gap-3"><span className="text-[11px] text-default-500">Activity window</span><div className="flex gap-1 rounded-lg border border-divider bg-content1 p-1">{([7, 30] as const).map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${focus} ${days === value ? 'bg-orange-400/15 text-primary' : 'text-default-500 hover:text-foreground'}`}>{value} days</button>)}</div></div></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Login activity" subtitle="Successful sign-ins across the selected period" index={0} className="lg:col-span-2" action={<span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[10px] text-default-500"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Logins</span>} footer={<>Up to 50 retained logins per account · UTC{data.invalidDates ? ` · ${data.invalidDates} invalid dates excluded` : ''}</>}><Activity key={days} data={data} onSelect={choose} /></ChartCard>
      <ChartCard title="Account access" subtitle="Current authorization status" index={1} footer="Select a legend to inspect the matching accounts."><Doughnut groups={data.access} onSelect={choose} /></ChartCard>
      <ChartCard title="Connection mix" subtitle="Latest device-reported connection types" index={2} footer={`${data.devices} device reports · not current connectivity`}><HorizontalBars groups={data.networks} onSelect={choose} /></ChartCard>
      <ChartCard title="Session outcomes" subtitle="Status of retained successful sign-ins" index={3} footer="Authorized sessions are not necessarily online."><Columns groups={data.sessions} unit="sessions" onSelect={choose} /></ChartCard>
      <ChartCard title="Device platforms" subtitle="Reported OS and Android build identifiers" index={4} footer="Unrecognized or missing OS remains Unknown."><HorizontalBars groups={data.platforms} onSelect={choose} /></ChartCard>
    </div>
    <div className="flex items-center justify-between gap-3 pt-2"><div><h2 className="text-foreground">Patterns & policy</h2><p className="mt-1 text-xs text-default-500">Inspect login timing and recorded VPN detections.</p></div><span className="hidden text-[11px] text-default-500 sm:block">Hover for values · Click to inspect</span></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Login activity by hour" subtitle={`Weekday × hour · successful logins in the last ${days} UTC days`} index={5} className="lg:col-span-2" footer="Darker cells mean fewer retained logins, not a lower security risk."><Heatmap data={data} onSelect={choose} /></ChartCard>
      <ChartCard title="VPN detection distribution" subtitle="Accounts grouped by recorded detection count" index={6} footer="VPN use is not proof of fraud. Counts reflect recorded policy events."><Columns groups={data.vpnBands} onSelect={choose} /></ChartCard>
    </div>
    <div className="pt-2"><h2 className="text-foreground">Device reporting</h2><p className="mt-1 text-xs text-default-500">Understand installation coverage, shared location and report age.</p></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Devices per account" subtitle="Number of saved installation reports" index={7} footer="Multiple registered devices do not imply simultaneous active sessions."><Columns groups={data.deviceCounts} onSelect={choose} /></ChartCard>
      <ChartCard title="Location coverage" subtitle="Location-sharing state of saved device reports" index={8} footer="Last shared device points only; IP-derived locations are excluded."><Composition groups={data.location} onSelect={choose} /></ChartCard>
      <ChartCard title="Report freshness" subtitle="Time since the last device report" index={9} footer="Report age is not an online/offline indicator."><HorizontalBars groups={data.freshness} onSelect={choose} /></ChartCard>
    </div>
    <Modal isOpen={Boolean(selection)} onClose={() => setSelection(null)} scrollBehavior="inside" placement="center" classNames={{ base: 'admin-ui admin-modal-panel bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent><ModalHeader className="flex-col gap-1 pr-10"><span>{selection?.label}</span><span className="text-xs font-normal text-default-400">{selectedUsers.length} matching accounts on this page</span></ModalHeader><ModalBody><div className="space-y-2">{selectedUsers.map(user => <button key={user.id} type="button" onClick={() => { setSelection(null); onOpenUser(user); }} className={`w-full rounded-xl border border-divider bg-content1 p-3 text-left hover:border-primary/50 ${focus}`}><span className="block truncate text-sm font-semibold">{user.name}</span><span className="mt-1 block truncate text-xs text-default-400">{user.email || 'No email'}</span><span className="mt-2 block text-xs text-primary">View security details ↗</span></button>)}</div>{selectedUsers.length === 0 && <p className="py-6 text-sm text-default-400">No matching accounts in this selection.</p>}</ModalBody><ModalFooter><Button variant="flat" onPress={() => setSelection(null)}>Close</Button></ModalFooter></ModalContent>
    </Modal>
  </div>;
}
