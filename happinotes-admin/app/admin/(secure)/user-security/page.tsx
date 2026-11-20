'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addToast, Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Skeleton, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { io } from 'socket.io-client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import UserSecurityCharts, { RealPacketLevelVisualization, SecurityChartsLoading, type PacketTelemetrySnapshot } from '@/components/admin/UserSecurityCharts';
import { apiRequest, BASE_URL, downloadCsv } from '@/lib/api';
import UserNetworkDetails from '@/components/admin/UserNetworkDetails';
import type { SecurityUser as UserRow } from '@/lib/user-security';

type Action = 'temporary' | 'permanent' | 'unban' | 'delete' | 'ip_ban' | 'ip_unban';
type SecurityTab = 'details' | 'charts' | 'packets';
const securityTabs: Array<{ key: SecurityTab; label: string }> = [{ key: 'details', label: 'Details' }, { key: 'charts', label: 'Charts' }, { key: 'packets', label: 'Packet-level' }];
const labels: Record<Action, string> = { temporary: 'Temporary ban', permanent: 'Permanent ban', unban: 'Unban', delete: 'Delete account', ip_ban: 'Block reported IP', ip_unban: 'Unblock reported IP' };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please try again.';
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Unavailable';
function NetworkIcon({ type }: { type?: string }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{type === 'wifi' ? <><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="20" r=".6" /></> : type === 'cellular' ? <><path d="M7 3h7l4 4v14H6V3Z" /><rect x="9" y="11" width="6" height="6" rx="1" /></> : <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a20 20 0 0 1 0 18 20 20 0 0 1 0-18" /></>}</svg>;
}
export default function UserSecurityPage() {
  const [tab, setTab] = useState<SecurityTab>('details');
  const reduceMotion = useReducedMotion();
  const [total, setTotal] = useState(0);
  const [loadedAt, setLoadedAt] = useState(0);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selection, setSelection] = useState<{ user: UserRow; page: number; query: string } | null>(null);
  const selectedUser = selection ? users.find(user => user.id === selection.user.id) || selection.user : null;
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [live, setLive] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<{ user: UserRow; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [packetTelemetry, setPacketTelemetry] = useState<PacketTelemetrySnapshot | null>(null);
  const [packetLoading, setPacketLoading] = useState(false);
  const [packetError, setPacketError] = useState('');
  const vpnCounts = useRef(new Map<string, number>());
  const generation = useRef(0);
  const busy = useRef(false);
  const load = useCallback(async (initial = false) => {
    if (initial) { setLoading(true); setUsers([]); }
    const requestId = ++generation.current;
    try {
      const result = await apiRequest<{ users: UserRow[]; total: number; totalPages: number; capabilities?: { deviceLocation?: boolean; singleActiveSession?: boolean; vpnDetection?: boolean } }>(`/admin/user-security?${new URLSearchParams({ page: String(page), query: search })}`, 'GET', undefined, localStorage.getItem('admin_token') || '');
      if (requestId !== generation.current) return;
      setBackendReady(result.capabilities?.deviceLocation === true && result.capabilities?.singleActiveSession === true && result.capabilities?.vpnDetection === true);
      for (const user of result.users) {
        const old = vpnCounts.current.get(user.id), count = user.vpn?.count || 0;
        if (old !== undefined && count > old) setNotice(`VPN detected for ${user.name}. Session revoked. Detection ${count} of 5${count >= 5 ? ' · Account and installation banned' : ''}.`);
        vpnCounts.current.set(user.id, count);
      }
      setTotal(result.total); setLoadedAt(Date.now());
      setUsers(result.users); setPages(Math.max(1, result.totalPages)); setError('');
    } catch (exception) { if (requestId === generation.current) setError(errorText(exception)); }
    finally { if (requestId === generation.current) setLoading(false); }
  }, [page, search]);
  const loadPacketTelemetry = useCallback(async () => {
    setPacketLoading(true); setPacketError('');
    try {
      const result = await apiRequest<PacketTelemetrySnapshot>('/admin/user-security/packet-telemetry', 'GET', undefined, localStorage.getItem('admin_token') || '');
      setPacketTelemetry(result);
    } catch (exception) {
      setPacketTelemetry(null); setPacketError(errorText(exception));
    } finally { setPacketLoading(false); }
  }, []);
  useEffect(() => { if (tab === 'packets') void loadPacketTelemetry(); }, [tab, loadPacketTelemetry]);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const invalidate = () => { generation.current += 1; };
    const socket = io(`${BASE_URL.replace(/\/api$/, '')}/admin`, { auth: callback => callback({ token: localStorage.getItem('admin_token') || '' }) });
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    socket.on('connect', () => { setLive(true); refresh(); });
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => setLive(false));
    socket.on('users:changed', refresh);
    const interval = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    void load(true);
    return () => { invalidate(); socket.disconnect(); clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const securityAlert = notice.startsWith('VPN detected');
    addToast({ title: securityAlert ? 'Security alert' : 'User Security', description: notice, severity: securityAlert ? 'warning' : 'success', timeout: securityAlert ? 7000 : 4000, shouldShowTimeoutProgress: true });
  }, [notice]);
  function open(user: UserRow, action: Action) { setDialog({ user, action }); setReason(''); setExpiry(''); setConfirmation(''); setDialogError(''); }
  async function submit() {
    if (!dialog || busy.current) return;
    if (!reason.trim()) { setDialogError('Add a reason.'); return; }
    if (dialog.action === 'temporary' && (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) { setDialogError('Choose a future expiry.'); return; }
    if (dialog.action === 'delete' && confirmation !== 'DELETE') { setDialogError('Type DELETE to confirm.'); return; }
    busy.current = true; setSaving(true); setDialogError('');
    try {
      const isIp = dialog.action === 'ip_ban' || dialog.action === 'ip_unban';
      const result = await apiRequest<{ message?: string }>(`/admin/user-security/${dialog.user.id}${isIp ? '/ip-ban' : dialog.action === 'delete' ? '' : '/ban'}`, isIp ? 'PUT' : dialog.action === 'delete' ? 'DELETE' : 'PATCH', { action: isIp ? (dialog.action === 'ip_ban' ? 'ban' : 'unban') : dialog.action, ip: isIp ? dialog.user.vpn?.lastIp : undefined, reason: reason.trim(), confirmation, ...(dialog.action === 'temporary' ? { expiresAt: new Date(expiry).toISOString() } : {}) }, localStorage.getItem('admin_token') || '');
      setNotice(result.message || 'Account status updated. Connected apps are notified immediately.'); setDialog(null); await load();
    } catch (exception) { setDialogError(errorText(exception)); }
    finally { busy.current = false; setSaving(false); }
  }
  async function exportUsers() {
    if (exporting) return;
    setExporting(true); setError('');
    try {
      const adminToken = localStorage.getItem('admin_token') || '';
      const fetchPage = (value: number) => apiRequest<{ users: UserRow[]; totalPages: number }>(`/admin/user-security?${new URLSearchParams({ page: String(value), query: search })}`, 'GET', undefined, adminToken);
      const first = await fetchPage(1);
      const allUsers = [...first.users];
      for (let current = 2; current <= Math.max(1, first.totalPages); current += 1) {
        const result = await fetchPage(current);
        allUsers.push(...result.users);
      }
      downloadCsv(`happinotes-user-security-${new Date().toISOString().slice(0, 10)}.csv`, ['ID', 'Name', 'Email', 'Status', 'Reason', 'Expires at', 'Public IP', 'Device IP', 'Network type', 'Carrier', 'Device model', 'OS', 'OS version', 'Location status', 'City', 'Region', 'Country', 'Latitude', 'Longitude', 'Last seen', 'Device count', 'Login history count', 'VPN detections', 'VPN last detected', 'VPN last IP', 'VPN IP blocked', 'Devices', 'Login history', 'Moderation history'], allUsers.map((user) => {
        const network = user.network;
        return [user.id, user.name, user.email, user.status, user.reason, user.expiresAt, network?.publicIp, network?.deviceIp, network?.networkType, network?.carrier, network?.deviceModel, network?.os, network?.osVersion, network?.locationStatus?.state, network?.geo?.city, network?.geo?.region, network?.geo?.country, network?.geo?.latitude, network?.geo?.longitude, network?.lastSeen, user.devices?.length || 0, user.loginHistory?.length || 0, user.vpn?.count || 0, user.vpn?.lastDetectedAt, user.vpn?.lastIp, user.vpn?.ipBlocked, user.devices, user.loginHistory, user.history];
      }));
      setNotice(`Exported ${allUsers.length} account${allUsers.length === 1 ? '' : 's'} to CSV.`);
    } catch (exception) {
      setError(errorText(exception));
    } finally {
      setExporting(false);
    }
  }
  return <section className="w-full min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Account management</p><h1 className="mt-2 text-3xl font-bold">User Security</h1><p className="mt-2 text-sm text-default-400">Review account details or explore security patterns in the chart view.</p></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-4">
    <div role="tablist" aria-label="User Security views" className="inline-flex gap-1 rounded-xl border border-divider bg-content2/50 p-1">
      {securityTabs.map(({ key: view, label }) => <button key={view} type="button" role="tab" id={`security-tab-${view}`} aria-selected={tab === view} aria-controls={`security-panel-${view}`} tabIndex={tab === view ? 0 : -1} onClick={() => setTab(view)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = securityTabs.findIndex(item => item.key === view);
        const next = event.key === 'Home' ? securityTabs[0].key : event.key === 'End' ? securityTabs[securityTabs.length - 1].key : securityTabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + securityTabs.length) % securityTabs.length].key;
        setTab(next); document.getElementById(`security-tab-${next}`)?.focus();
      }} className={`relative rounded-lg px-5 py-2.5 text-sm font-medium outline-offset-2 focus-visible:outline-primary ${tab === view ? 'text-primary' : 'text-default-400 hover:text-foreground'}`}>
        {tab === view && <motion.span layoutId="security-tab-highlight" className="absolute inset-0 rounded-lg border border-primary/20 bg-primary/10" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
        <span className="relative flex items-center gap-2"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{view === 'details' ? <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h1M3 12h1M3 18h1" /></> : view === 'charts' ? <><path d="M4 20h17M6 16V9M12 16V4M18 16v-5" /></> : <><path d="M4 6h16v12H4z" /><path d="M8 10h8M8 14h5" /><path d="M7 3v3M17 3v3" /></>}</svg>{label}</span>
      </button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3"><Input aria-label="Search users" placeholder="Search name or email" value={query} onValueChange={setQuery} className="w-full sm:w-56" isClearable onClear={() => setQuery('')} /><Chip size="sm" color={live ? 'success' : 'default'} variant="flat">{live ? 'Live updates' : 'Refreshing every 15 seconds'}</Chip><Button size="sm" variant="bordered" isLoading={exporting} isDisabled={exporting} onPress={() => void exportUsers()}>{exporting ? 'Exporting…' : 'Export CSV'}</Button><Button size="sm" variant="flat" onPress={() => void load()}>Refresh</Button></div>
    </div>
    {tab === 'details' && <p className="text-xs leading-5 text-default-400">Public IP is observed by the server. Device IP, carrier and network type are device-reported and may be unavailable. IPs can be shared or changed; the map is approximate, not a street address. Bans apply to the account.</p>}
    {backendReady === false && <p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">The connected backend has not confirmed device-location storage, single-session login and VPN reporting support. Deploy the updated backend to the API server used by both the app and admin, then refresh. Restarting this admin panel alone will not enable those features.</p>}
    {error && <p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">{error}</p>}
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} id={`security-panel-${tab}`} role="tabpanel" aria-labelledby={`security-tab-${tab}`} tabIndex={0} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.16 }} className="min-w-0 space-y-5 focus-visible:outline-primary">
        {tab === 'charts' ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-4"><p className="text-xs text-default-400">Page {page} of {pages} · <strong className="text-foreground">{users.length} accounts in these charts</strong> · {total} matching accounts{search ? ` · Search: “${search}”` : ''}</p><span className="text-[11px] text-default-400">{loadedAt ? `Updated ${new Date(loadedAt).toLocaleTimeString()}` : 'Waiting for security data'}</span></div>
          {loading ? <SecurityChartsLoading /> : error && users.length === 0 ? <p className="py-12 text-center text-sm text-default-400">Charts could not load. Use Refresh to retry.</p> : users.length === 0 ? <p className="py-12 text-center text-sm text-default-400">No matching accounts. Change your search to explore security charts.</p> : <UserSecurityCharts key={`${page}:${search}`} users={users} loadedAt={loadedAt} onOpenUser={user => { setSelection({ user, page, query: search }); setDetailsOpen(true); }} />}
        </> : tab === 'packets' ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Packet-Level Visualization</p><p className="mt-1 text-xs text-default-400">Packet data appears only when the connected backend reports real packet telemetry.</p></div><span className="text-[11px] text-default-400">{loadedAt ? `Updated ${new Date(loadedAt).toLocaleTimeString()}` : 'Waiting for security data'}</span></div>
          {loading || packetLoading ? <SecurityChartsLoading /> : error && users.length === 0 ? <p className="py-12 text-center text-sm text-default-400">Packet data could not load. Use Refresh to retry.</p> : packetError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">{packetError}</p> : users.length === 0 ? <p className="py-12 text-center text-sm text-default-400">No matching accounts for packet inspection. Change your search to explore the stream.</p> : <RealPacketLevelVisualization key={`${page}:${search}`} users={users} telemetry={packetTelemetry} />}
        </> : <>
    {loading ? <div className="overflow-hidden rounded-2xl border border-divider bg-content1" aria-label="Loading users" aria-busy="true"><div className="overflow-x-auto"><Table aria-label="Loading user security accounts" removeWrapper className="min-w-[920px]" classNames={{ table: 'w-full', th: 'h-12 bg-content2 px-4 first:pl-5 last:pr-5', td: 'border-b border-divider/60 px-4 py-4 first:pl-5 last:pr-5 last:border-0' }}><TableHeader>{[0, 1, 2, 3, 4, 5, 6].map(index => <TableColumn key={index}><Skeleton className="h-3 w-20 rounded" /></TableColumn>)}</TableHeader><TableBody>{[0, 1, 2, 3, 4, 5, 6].map(index => <TableRow key={index}><TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 shrink-0 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-32 rounded" /><Skeleton className="h-2.5 w-24 rounded" /></div></div></TableCell><TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell><TableCell><div className="space-y-2"><Skeleton className="h-3 w-6 rounded" /><Skeleton className="h-2.5 w-20 rounded" /></div></TableCell><TableCell><div className="space-y-2"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-2.5 w-28 rounded" /></div></TableCell><TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell><TableCell><div className="space-y-2"><Skeleton className="h-3 w-28 rounded" /><Skeleton className="h-2.5 w-20 rounded" /></div></TableCell><TableCell><Skeleton className="ml-auto h-8 w-24 rounded-lg" /></TableCell></TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between border-t border-divider px-5 py-3"><Skeleton className="h-3 w-36 rounded" /><Skeleton className="h-8 w-28 rounded-lg" /></div></div> : users.length === 0 ? <Card><CardBody className="p-10 text-center">No matching users.</CardBody></Card> : <div className="space-y-3" aria-label="User security list">{users.map(user => {
      const network = user.network;
      const statusColor = user.status === 'active' ? 'bg-success/10 text-success' : user.status === 'temporary_ban' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger';
      return <button key={user.id} type="button" aria-label={`View network details for ${user.name}`} aria-haspopup="dialog" onClick={() => { setSelection({ user, page, query: search }); setDetailsOpen(true); }} className="group flex w-full items-center gap-3 rounded-2xl border border-divider bg-content1 p-4 text-left transition-colors hover:border-primary/40 hover:bg-content2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:gap-4 sm:p-5">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{user.name?.trim().charAt(0).toUpperCase() || '?'}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold sm:text-base">{user.name}</span><span className="mt-0.5 block truncate text-xs text-default-400">{user.email || 'No email'}</span><span className="mt-1 block text-xs text-default-400">{user.devices?.length ? `${user.devices.length} registered ${user.devices.length === 1 ? 'device' : 'devices'}` : 'Legacy or unreported device'}{user.loginHistory?.length ? ` · ${user.loginHistory.length} recent logins` : ''}</span>{!!user.vpn?.count && <span className="mt-2 inline-flex rounded-full bg-danger/15 px-2 py-1 text-[11px] font-semibold text-danger">VPN detected · {user.vpn.count}</span>}<span className="mt-2 block truncate font-mono text-xs text-default-400 sm:hidden">{network?.publicIp || 'IP not reported'}</span></span>
        <span className="hidden w-40 shrink-0 sm:block"><span className="block font-mono text-sm">{network?.publicIp || 'IP not reported'}</span><span className="mt-1 block truncate text-xs text-default-400">{[network?.geo?.city, network?.geo?.country].filter(Boolean).join(', ') || 'Location pending'}</span></span>
        <span className="hidden w-32 shrink-0 items-center gap-2 text-default-400 xl:flex"><NetworkIcon type={network?.networkType} /><span className="truncate text-xs capitalize">{network?.networkType || 'Unknown'} network</span></span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:text-xs ${statusColor}`}>{user.status.replaceAll('_', ' ')}</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-default-400 group-hover:text-primary"><path d="m9 5 7 7-7 7" /></svg>
      </button>;
    })}</div>}
        </>}
      </motion.div>
    </AnimatePresence>
    {tab === 'details' && !loading && users.length > 0 && <div className="overflow-hidden rounded-2xl border border-divider bg-content1" aria-label="User security table">
      <div className="overflow-x-auto">
        <Table aria-label="User security accounts" removeWrapper className="min-w-[920px]" classNames={{ table: 'w-full', th: 'h-12 bg-content2 px-4 text-[10px] font-bold uppercase tracking-[.12em] text-default-400 first:pl-5 last:pr-5', td: 'border-b border-divider/60 px-4 py-3.5 first:pl-5 last:pr-5 last:border-0' }}>
          <TableHeader>
            <TableColumn>Account</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Devices</TableColumn>
            <TableColumn>Connection</TableColumn>
            <TableColumn>Risk signals</TableColumn>
            <TableColumn>Last report</TableColumn>
            <TableColumn align="end">Actions</TableColumn>
          </TableHeader>
          <TableBody>
            {users.map(user => {
              const network = user.network;
              const statusColor = user.status === 'active' ? 'success' : user.status === 'temporary_ban' ? 'warning' : 'danger';
              return <TableRow key={user.id} className="group hover:bg-content2/40">
                <TableCell><div className="flex min-w-[220px] items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{user.name?.trim().charAt(0).toUpperCase() || '?'}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground" title={user.name}>{user.name}</p><p className="mt-1 truncate text-xs text-default-400" title={user.email || undefined}>{user.email || 'No email'}</p></div></div></TableCell>
                <TableCell><Chip size="sm" color={statusColor} variant="flat" className="capitalize">{user.status.replaceAll('_', ' ')}</Chip></TableCell>
                <TableCell><div className="text-sm tabular-nums text-default-600">{user.devices?.length || 0}</div><div className="mt-1 text-[11px] text-default-400">{user.loginHistory?.length || 0} recent logins</div></TableCell>
                <TableCell><div className="flex items-center gap-2 text-sm text-default-600"><NetworkIcon type={network?.networkType} /><span className="capitalize">{network?.networkType || 'Unknown'}</span></div><p className="mt-1 max-w-[150px] truncate font-mono text-[11px] text-default-400">{network?.publicIp || 'IP not reported'}</p></TableCell>
                <TableCell>{user.vpn?.count ? <Chip size="sm" color="danger" variant="flat">VPN · {user.vpn.count}</Chip> : <span className="text-xs text-default-400">No recorded VPN</span>}</TableCell>
                <TableCell><span className="whitespace-nowrap text-xs text-default-400">{date(network?.lastSeen)}</span><p className="mt-1 max-w-[150px] truncate text-[11px] text-default-400">{[network?.geo?.city, network?.geo?.country].filter(Boolean).join(', ') || 'Location pending'}</p></TableCell>
                <TableCell><div className="flex justify-end"><Button size="sm" variant="light" color="primary" onPress={() => { setSelection({ user, page, query: search }); setDetailsOpen(true); }}>View details</Button></div></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3"><p className="text-xs text-default-400">Page {page} of {pages} · {total} matching accounts</p>{pages > 1 ? <Pagination aria-label="User security pagination" page={page} total={pages} onChange={setPage} showControls isCompact size="sm" radius="lg" color="primary" siblings={0} boundaries={1} /> : null}</div>
    </div>}
    <div className="flex items-center justify-center gap-4"><Button size="sm" variant="flat" isDisabled={page <= 1} onPress={() => setPage(value => value - 1)}>Previous</Button><span className="text-sm">Page {page} of {pages}</span><Button size="sm" variant="flat" isDisabled={page >= pages} onPress={() => setPage(value => value + 1)}>Next</Button></div>
    <Modal size="5xl" isOpen={detailsOpen && Boolean(selection) && !dialog} onClose={() => setDetailsOpen(false)} scrollBehavior="inside" placement="center" classNames={{ base: 'admin-ui admin-modal-panel bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-divider pr-12"><span className="text-xs font-medium uppercase tracking-wider text-primary">User network details</span><span className="mt-1 text-xl">{selectedUser?.name}</span><span className="break-all text-xs font-normal text-default-400">{selectedUser?.email || 'No email'} · {selectedUser?.id}</span></ModalHeader>
        <ModalBody className="py-5">
          {selectedUser && selection && <>
            <div className="flex flex-wrap items-center gap-3"><Chip size="sm" color={selectedUser.status === 'active' ? 'success' : selectedUser.status === 'temporary_ban' ? 'warning' : 'danger'} variant="flat">{selectedUser.status.replaceAll('_', ' ')}</Chip><span className="text-xs text-default-400">Last report: {date(selectedUser.network?.lastSeen)}</span><Chip size="sm" variant="flat">{selectedUser.devices?.length || 0} registered devices</Chip></div>
            {selectedUser.reason && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{selectedUser.reason}{selectedUser.expiresAt ? ` · Until ${date(selectedUser.expiresAt)}` : ''}</p>}
            {selectedUser.vpn && (selectedUser.vpn.count > 0 || selectedUser.vpn.ipBlocked) && <section className="rounded-xl border border-danger/30 bg-danger/10 p-4"><p className="font-semibold text-danger">VPN detections · {selectedUser.vpn.count} / 5</p><p className="mt-1 text-xs text-default-400">Android app-reported VPN connection, not proof of fraud. Last detection: {date(selectedUser.vpn.lastDetectedAt)} · Reported server IP: {selectedUser.vpn.lastIp || 'Unavailable'}</p>{selectedUser.vpn.lastIp && <Button size="sm" className="mt-3" color="danger" variant="flat" onPress={() => open(selectedUser, selectedUser.vpn?.ipBlocked ? 'ip_unban' : 'ip_ban')}>{selectedUser.vpn.ipBlocked ? 'Unblock reported IP' : 'Review IP block'}</Button>}</section>}
            <UserNetworkDetails key={selectedUser.id} user={selectedUser} page={selection.page} query={selection.query} />
            {selectedUser.history.length > 0 && <details className="border-t border-divider pt-3 text-xs text-default-400"><summary className="cursor-pointer py-2">Recent moderation history</summary><ul className="space-y-2">{selectedUser.history.slice().reverse().map((entry, index) => <li key={index}>{date(entry.at)} · {entry.action} · {entry.reason}</li>)}</ul></details>}
          </>}
        </ModalBody>
        <ModalFooter className="flex-wrap justify-between gap-3 border-t border-divider">
          <Button size="sm" variant="flat" onPress={() => setDetailsOpen(false)}>Close details</Button>
          {selectedUser && <div className="flex flex-wrap gap-2"><Button size="sm" variant="flat" color="warning" isDisabled={selectedUser.status === 'deletion_pending'} onPress={() => open(selectedUser, 'temporary')}>Temporary ban</Button><Button size="sm" variant="flat" color="danger" isDisabled={selectedUser.status === 'deletion_pending'} onPress={() => open(selectedUser, 'permanent')}>Permanent ban</Button>{selectedUser.status.includes('ban') && <Button size="sm" variant="flat" color="success" onPress={() => open(selectedUser, 'unban')}>Unban</Button>}<Button size="sm" variant="light" color="danger" isDisabled={selectedUser.status === 'deletion_pending'} onPress={() => open(selectedUser, 'delete')}>Delete account</Button></div>}
        </ModalFooter>
      </ModalContent>
    </Modal>
    <Modal isOpen={Boolean(dialog)} onClose={() => { if (!saving) setDialog(null); }} isDismissable={!saving} isKeyboardDismissDisabled={saving} hideCloseButton={saving} scrollBehavior="inside" placement="center" classNames={{ base: 'admin-ui admin-modal-panel bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent><ModalHeader>{dialog ? labels[dialog.action] : ''}</ModalHeader><ModalBody><p className="text-sm text-default-400">{dialog?.user.name} · {dialog?.user.email}</p><p className="text-sm">{dialog?.action === 'ip_ban' || dialog?.action === 'ip_unban' ? `IP: ${dialog.user.vpn?.lastIp}. This applies to all customer accounts connecting through this public IP, including unrelated people sharing a network. Administrator access is excluded.` : dialog?.action === 'delete' ? 'Account access is revoked immediately. Deletion enters the existing cleanup workflow; retained purchase records follow its existing policy.' : dialog?.action === 'unban' ? 'Restore account access, reset the VPN strike count and release associated installation/email blocks. The user must sign in again. Manual IP blocks are managed separately.' : 'Access is revoked on all sessions. Connected apps are notified; offline apps are checked when they reconnect.'}</p><Textarea label="Reason" description={dialog?.action === 'temporary' || dialog?.action === 'permanent' ? 'This reason is shown to the user when access is denied.' : dialog?.action === 'ip_ban' || dialog?.action === 'ip_unban' ? 'Saved with the IP restriction.' : 'Recorded in moderation history.'} value={reason} onValueChange={setReason} maxLength={500} isRequired isDisabled={saving} />{dialog?.action === 'temporary' && <Input type="datetime-local" label="Ban expiry (your local time)" value={expiry} onValueChange={setExpiry} isRequired isDisabled={saving} />}{dialog?.action === 'delete' && <Input label="Type DELETE to confirm" value={confirmation} onValueChange={setConfirmation} isDisabled={saving} />}{dialogError && <p role="alert" className="text-sm text-danger">{dialogError}</p>}</ModalBody><ModalFooter><Button variant="flat" isDisabled={saving} onPress={() => setDialog(null)}>Cancel</Button><Button color={dialog?.action === 'unban' ? 'success' : 'danger'} isLoading={saving} onPress={() => void submit()}>{dialog ? labels[dialog.action] : 'Confirm'}</Button></ModalFooter></ModalContent>
    </Modal>
  </section>;
}
