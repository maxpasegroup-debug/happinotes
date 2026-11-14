'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Skeleton, Textarea } from '@heroui/react';
import { io } from 'socket.io-client';
import { apiRequest, BASE_URL } from '@/lib/api';

type Geo = { status?: string; latitude?: number; longitude?: number; city?: string; region?: string; country?: string; provider?: string };
type UserRow = { id: string; name: string; email?: string; status: string; reason?: string; expiresAt?: string; history: { action: string; reason: string; at: string }[]; network?: { publicIp?: string; deviceIp?: string; networkType?: string; carrier?: string; deviceModel?: string; os?: string; osVersion?: string; lastSeen?: string; geo?: Geo } };
type Action = 'temporary' | 'permanent' | 'unban' | 'delete';
const labels: Record<Action, string> = { temporary: 'Temporary ban', permanent: 'Permanent ban', unban: 'Unban', delete: 'Delete account' };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please try again.';
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Unavailable';
function NetworkIcon({ type }: { type?: string }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{type === 'wifi' ? <><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="20" r=".6" /></> : type === 'cellular' ? <><path d="M7 3h7l4 4v14H6V3Z" /><rect x="9" y="11" width="6" height="6" rx="1" /></> : <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a20 20 0 0 1 0 18 20 20 0 0 1 0-18" /></>}</svg>;
}
function MiniMap({ geo }: { geo?: Geo }) {
  const lat = geo?.latitude, lon = geo?.longitude;
  if (geo?.status !== 'approximate' || typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return <div className="flex min-h-40 items-center justify-center rounded-xl bg-content2 p-5 text-center text-xs text-default-400">{geo?.status === 'not_configured' ? 'IP location lookup has not been configured.' : 'Approximate location unavailable.'}</div>;
  const bbox = [Math.max(-180, lon - 0.15), Math.max(-85, lat - 0.1), Math.min(180, lon + 0.15), Math.min(85, lat + 0.1)].join(',');
  const src = `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({ bbox, layer: 'mapnik', marker: `${lat},${lon}` })}`;
  return <div><iframe title="Approximate IP location" src={src} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-44 w-full rounded-xl border-0" /><p className="mt-2 text-xs text-default-400">Approximate IP location · {[geo.city, geo.region, geo.country].filter(Boolean).join(', ')} · <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p></div>;
}

export default function UserSecurityPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [live, setLive] = useState(false);
  const [dialog, setDialog] = useState<{ user: UserRow; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const generation = useRef(0);
  const busy = useRef(false);
  const load = useCallback(async () => {
    const requestId = ++generation.current;
    try {
      const result = await apiRequest<{ users: UserRow[]; totalPages: number }>(`/admin/user-security?${new URLSearchParams({ page: String(page), query: search })}`, 'GET', undefined, localStorage.getItem('admin_token') || '');
      if (requestId !== generation.current) return;
      setUsers(result.users); setPages(Math.max(1, result.totalPages)); setError('');
    } catch (exception) { if (requestId === generation.current) setError(errorText(exception)); }
    finally { if (requestId === generation.current) setLoading(false); }
  }, [page, search]);
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
    void load();
    return () => { invalidate(); socket.disconnect(); clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  function open(user: UserRow, action: Action) { setDialog({ user, action }); setReason(''); setExpiry(''); setConfirmation(''); setDialogError(''); }
  async function submit() {
    if (!dialog || busy.current) return;
    if (!reason.trim()) { setDialogError('Add a reason.'); return; }
    if (dialog.action === 'temporary' && (!expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) { setDialogError('Choose a future expiry.'); return; }
    if (dialog.action === 'delete' && confirmation !== 'DELETE') { setDialogError('Type DELETE to confirm.'); return; }
    busy.current = true; setSaving(true); setDialogError('');
    try {
      const result = await apiRequest<{ message?: string }>(`/admin/user-security/${dialog.user.id}${dialog.action === 'delete' ? '' : '/ban'}`, dialog.action === 'delete' ? 'DELETE' : 'PATCH', { action: dialog.action, reason: reason.trim(), confirmation, ...(dialog.action === 'temporary' ? { expiresAt: new Date(expiry).toISOString() } : {}) }, localStorage.getItem('admin_token') || '');
      setNotice(result.message || 'Account status updated. Connected apps are notified immediately.'); setDialog(null); await load();
    } catch (exception) { setDialogError(errorText(exception)); }
    finally { busy.current = false; setSaving(false); }
  }
  return <section className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-primary">Account management</p><h1 className="mt-2 text-3xl font-bold">User Security</h1><p className="mt-2 text-sm text-default-400">Review recent network details and manage account access.</p></header>
    <div className="flex flex-wrap items-center gap-3"><Input aria-label="Search users" placeholder="Search name or email" value={query} onValueChange={setQuery} className="max-w-sm" isClearable onClear={() => setQuery('')} /><Chip size="sm" color={live ? 'success' : 'default'} variant="flat">{live ? 'Live updates' : 'Refreshing every 15 seconds'}</Chip><Button size="sm" variant="flat" onPress={() => void load()}>Refresh</Button></div>
    <p className="text-xs leading-5 text-default-400">Public IP is observed by the server. Device IP, carrier and network type are device-reported and may be unavailable. IPs can be shared or changed; the map is approximate, not a street address. Bans apply to the account.</p>
    {error && <p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-success/10 p-4 text-sm text-success">{notice}</p>}
    {loading ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div> : users.length === 0 ? <Card><CardBody className="p-10 text-center">No matching users.</CardBody></Card> : users.map(user => {
      const network = user.network; const provider = network?.geo?.provider || network?.carrier || 'Provider unavailable';
      return <Card key={user.id} className="border border-divider"><CardBody className="gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{user.name}</h2><p className="text-sm text-default-400">{user.email || 'No email'} · {user.id}</p></div><Chip color={user.status === 'active' ? 'success' : user.status === 'temporary_ban' ? 'warning' : 'danger'} variant="flat">{user.status.replaceAll('_', ' ')}</Chip></div>
        {user.reason && <p className="text-sm text-danger">{user.reason}{user.expiresAt ? ` · Until ${date(user.expiresAt)}` : ''}</p>}
        <div className="grid gap-5 md:grid-cols-2"><div className="space-y-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><NetworkIcon type={network?.networkType} /></span><div><p className="text-sm font-medium capitalize">{network?.networkType || 'Unknown'} network</p><p className="text-xs text-default-400">Last seen {date(network?.lastSeen)}</p></div></div>
          <div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-content3 text-xs font-bold">{provider === 'Provider unavailable' ? '?' : provider.slice(0, 2).toUpperCase()}</span><p className="text-sm">{provider}</p></div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-default-400">Public IP</dt><dd className="break-all font-mono">{network?.publicIp || 'Unavailable'}</dd><dt className="text-default-400">Device IP</dt><dd className="break-all font-mono">{network?.deviceIp || 'Unavailable'}</dd><dt className="text-default-400">SIM carrier</dt><dd>{network?.carrier || 'Unavailable'}</dd><dt className="text-default-400">Device</dt><dd>{[network?.deviceModel, network?.os, network?.osVersion].filter(Boolean).join(' · ') || 'Unavailable'}</dd></dl></div><MiniMap geo={network?.geo} /></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="flat" color="warning" isDisabled={user.status === 'deletion_pending'} onPress={() => open(user, 'temporary')}>Temporary ban</Button><Button size="sm" variant="flat" color="danger" isDisabled={user.status === 'deletion_pending'} onPress={() => open(user, 'permanent')}>Permanent ban</Button>{user.status.includes('ban') && <Button size="sm" variant="flat" color="success" onPress={() => open(user, 'unban')}>Unban</Button>}<Button size="sm" variant="light" color="danger" isDisabled={user.status === 'deletion_pending'} onPress={() => open(user, 'delete')}>Delete account</Button></div>
        {user.history.length > 0 && <details className="text-xs text-default-400"><summary className="cursor-pointer py-2">Recent moderation history</summary><ul className="space-y-2">{user.history.slice().reverse().map((entry, index) => <li key={index}>{date(entry.at)} · {entry.action} · {entry.reason}</li>)}</ul></details>}
      </CardBody></Card>;
    })}
    <div className="flex items-center justify-center gap-4"><Button size="sm" variant="flat" isDisabled={page <= 1} onPress={() => setPage(value => value - 1)}>Previous</Button><span className="text-sm">Page {page} of {pages}</span><Button size="sm" variant="flat" isDisabled={page >= pages} onPress={() => setPage(value => value + 1)}>Next</Button></div>
    <Modal isOpen={Boolean(dialog)} onClose={() => { if (!saving) setDialog(null); }} isDismissable={!saving} isKeyboardDismissDisabled={saving} hideCloseButton={saving} scrollBehavior="inside" placement="center" classNames={{ base: 'dark admin-ui admin-modal-panel bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent><ModalHeader>{dialog ? labels[dialog.action] : ''}</ModalHeader><ModalBody><p className="text-sm text-default-400">{dialog?.user.name} · {dialog?.user.email}</p><p className="text-sm">{dialog?.action === 'delete' ? 'Account access is revoked immediately. Deletion enters the existing cleanup workflow; retained purchase records follow its existing policy.' : dialog?.action === 'unban' ? 'Restore account access. The user must sign in again.' : 'Access is revoked on all sessions. Connected apps are notified; offline apps are checked when they reconnect.'}</p><Textarea label="Reason" description={dialog?.action === 'temporary' || dialog?.action === 'permanent' ? 'This reason is shown to the user when access is denied.' : 'Recorded in moderation history.'} value={reason} onValueChange={setReason} maxLength={500} isRequired isDisabled={saving} />{dialog?.action === 'temporary' && <Input type="datetime-local" label="Ban expiry (your local time)" value={expiry} onValueChange={setExpiry} isRequired isDisabled={saving} />}{dialog?.action === 'delete' && <Input label="Type DELETE to confirm" value={confirmation} onValueChange={setConfirmation} isDisabled={saving} />}{dialogError && <p role="alert" className="text-sm text-danger">{dialogError}</p>}</ModalBody><ModalFooter><Button variant="flat" isDisabled={saving} onPress={() => setDialog(null)}>Cancel</Button><Button color={dialog?.action === 'unban' ? 'success' : 'danger'} isLoading={saving} onPress={() => void submit()}>{dialog ? labels[dialog.action] : 'Confirm'}</Button></ModalFooter></ModalContent>
    </Modal>
  </section>;
}
