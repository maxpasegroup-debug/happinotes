'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import DashboardCharts from '@/components/admin/DashboardCharts';
import { apiRequest } from '@/lib/api';
import type { AnalyticsSnapshot, AnalyticsBook, AnalyticsBite, AnalyticsUser, AnalyticsStats } from '@/lib/admin-dashboard-charts';

export default function AdminDashboardPage() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [months, setMonths] = useState<6 | 12>(6);
  const generation = useRef(0), pending = useRef(false);
  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    const version = ++generation.current, token = localStorage.getItem('admin_token') || '';
    try {
      const results = await Promise.allSettled([
        apiRequest<{ contents: AnalyticsBook[] }>('/admin/contents', 'GET', undefined, token),
        apiRequest<{ happyBites: AnalyticsBite[] }>('/admin/happy-bites', 'GET', undefined, token),
        apiRequest<{ users: AnalyticsUser[] }>('/admin/users', 'GET', undefined, token),
        apiRequest<{ stats: AnalyticsStats }>('/admin/stats', 'GET', undefined, token),
      ]);
      if (version !== generation.current) return;
      const [books, bites, users, stats] = results;
      const snapshot: AnalyticsSnapshot = {
        books: books.status === 'fulfilled' && Array.isArray(books.value.contents) ? books.value.contents : null,
        bites: bites.status === 'fulfilled' && Array.isArray(bites.value.happyBites) ? bites.value.happyBites : null,
        users: users.status === 'fulfilled' && Array.isArray(users.value.users) ? users.value.users : null,
        stats: stats.status === 'fulfilled' && stats.value.stats ? stats.value.stats : null,
        loadedAt: Date.now(), failed: [],
      };
      snapshot.failed = [!snapshot.books && 'Story Books', !snapshot.bites && 'Happy Bites', !snapshot.users && 'Users', !snapshot.stats && 'Subscriptions'].filter(Boolean) as string[];
      setData(snapshot);
    } finally { if (version === generation.current) { pending.current = false; setBusy(false); } }
  }, []);
  useEffect(() => {
    const invalidate = () => { generation.current++; pending.current = false; };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('happinotes:catalog-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { invalidate(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('happinotes:catalog-changed', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  return <section className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Application analytics</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your app, in perspective.</h1><p className="mt-3 text-sm text-default-400">The whole library. Your community. One clear overview.</p></div><div className="flex flex-wrap items-center gap-3"><div className="flex rounded-xl border border-divider bg-content1 p-1" aria-label="Chart period">{([6, 12] as const).map(value => <button type="button" key={value} aria-pressed={months === value} onClick={() => setMonths(value)} className={`rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary ${months === value ? 'bg-primary/15 text-primary' : 'text-default-400 hover:text-foreground'}`}>{value} months</button>)}</div><Button size="sm" variant="bordered" isLoading={busy} onPress={() => void load()} className="h-10 rounded-xl border-divider">Refresh charts</Button></div></header>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider pb-4 text-[11px] text-default-400"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />All records · refreshes every minute</span><span>{data ? `Updated ${new Date(data.loadedAt).toLocaleTimeString()} · UTC chart dates` : 'Loading application data…'}</span></div>
    {!!data?.failed.length && <p role="alert" className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning">Could not load: {data.failed.join(', ')}. Those charts are marked unavailable. Use Refresh charts to retry.</p>}
    <DashboardCharts data={data} months={months} />
  </section>;
}
