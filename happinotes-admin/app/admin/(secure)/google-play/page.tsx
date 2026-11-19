'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Select, SelectItem, Skeleton, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiRequest } from '@/lib/api';

type Release = { track: string; status: string; statusSource: string; versionCodes: string[]; name?: string; releaseNotes?: Array<{ language: string; text: string }>; userFraction?: number; countryTargeting?: Record<string, unknown> };
type Track = { track: string; releases: Release[] };
type App = { store?: { subscriptions: "enabled" | "disabled" | "unknown"; production: "published" | "unpublished" | "unknown"; subscriptionReason?: string; productionReason?: string; listingUrl: string | null }; packageName: string; appName: string; nameSource: string; available: boolean; reason?: string; tracks: Track[]; latestRelease?: Release; status: string; statusSource: string };

function StoreStatus({ app }: { app: App }) {
  const store = app.store;
  if (!store) return <p className="mt-3 text-xs text-warning">The connected backend did not return store status. Deploy the updated backend, then select Sync now.</p>;
  const subscription = { enabled: 'Enabled', disabled: 'No active plans', unknown: store.subscriptionReason || 'Google could not confirm subscription status.' };
  const production = { published: 'Published to production', unpublished: 'No published production release', unknown: store.productionReason || 'Google could not confirm production availability.' };
  return <div className="mt-3 space-y-1 text-xs">
    <p><span className="text-default-500">Subscriptions · </span>{subscription[store?.subscriptions ?? 'unknown']}</p>
    <p><span className="text-default-500">Public availability · </span>{production[store?.production ?? 'unknown']}</p>
    {store?.production === 'published' && store.listingUrl && (
      <a className="inline-block py-1 font-medium text-primary underline" href={store.listingUrl} target="_blank" rel="noopener noreferrer">View on Google Play ↗</a>
    )}
  </div>;
}
type Overview = { generatedAt: string; apps: App[]; totals: { configuredApps: number; appsWithData: number; appsUnavailable: number; published: number; draft: number; inReview: number | null; rejected: number | null }; statusNotes: string[] };
type SyncStatus = { configured: boolean; credentials: { configured: boolean; clientEmail?: string; projectId?: string }; packageNames: string[]; scopes: string[]; cacheTtlSeconds: number; lastSyncedAt?: string; lastError?: string; reason?: string };
type Review = { reviewId: string; authorName?: string; starRating?: number; text?: string; language?: string; appVersionCode?: string; appVersionName?: string; deviceMetadata?: Record<string, unknown>; reviewDate?: string; developerReply?: { text?: string; date?: string } };
type Reviews = { reviews: Review[]; nextPageToken?: string; totalRetrieved: number; ratingDistribution: Record<string, number>; averageRating: number | null; averageLabel: string };
type Analytics = { available: boolean; reason?: string; crashRate?: unknown; anrRate?: unknown; metricsNote: string };

function MetricIcon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    play: 'M5 3 19 12 5 21V3Z M5 3l8 9-8 9',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 3 M4 16l2 3a7 7 0 0 0 12-2',
    apps: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    release: 'M4 5h16v14H4z M8 9h8 M8 13h5',
    review: 'M4 5h16v12H8l-4 4V5Z M8 9h8 M8 13h5',
    chart: 'M4 19V5 M4 19h16 M8 16v-4 M12 16V8 M16 16V6',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M4.9 4.9 7 7m10 10 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m10-10 2.1-2.1',
    check: 'm5 12 4 4L19 6',
    warning: 'M12 4 3 20h18L12 4Zm0 5v5m0 3h.01',
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.apps} /></svg>;
}

function MetricCard({ label, value, note, icon, tone = 'primary' }: { label: string; value: string; note: string; icon: string; tone?: 'primary' | 'success' | 'warning' | 'danger' }) {
  return <Card shadow="none" className="border border-divider bg-content1/70"><CardBody className="gap-4 p-5"><div className="flex items-start justify-between gap-3"><span className="text-xs font-medium text-default-500">{label}</span><span className={`rounded-xl p-2.5 ${tone === 'success' ? 'bg-success/10 text-success' : tone === 'warning' ? 'bg-warning/10 text-warning' : tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}><MetricIcon name={icon} /></span></div><p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p><p className="text-xs leading-5 text-default-500">{note}</p></CardBody></Card>;
}

function LoadingCards() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading Google Play data" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <Card key={index} shadow="none" className="border border-divider"><CardBody className="gap-4 p-5"><Skeleton className="h-3 w-24 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-3 w-36 rounded-lg" /></CardBody></Card>)}</div>;
}

function Unavailable({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm leading-6 text-warning-700 dark:text-warning-200"><div className="flex items-start gap-3"><MetricIcon name="warning" /><span>{children}</span></div></div>;
}

function displayRelease(release?: Release) {
  if (!release) return 'Unavailable';
  return release.versionCodes.length ? release.versionCodes.join(', ') : 'Version unavailable';
}

function formatDate(value?: string) {
  if (!value) return 'Not returned by API';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not returned by API' : date.toLocaleString();
}

export default function GooglePlayPage() {
  const reduce = useReducedMotion();
  const token = typeof window === 'undefined' ? '' : window.localStorage.getItem('admin_token') || '';
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [tab, setTab] = useState('overview');
  const [reviews, setReviews] = useState<Reviews | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewRating, setReviewRating] = useState('all');
  const [reviewToken, setReviewToken] = useState('');
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setBusy(true); setError('');
    try {
      const [data, status] = await Promise.all([
        apiRequest<Overview>(refresh ? '/admin/google-play/sync' : '/admin/google-play/overview', refresh ? 'POST' : 'GET', refresh ? {} : undefined, token),
        apiRequest<SyncStatus>('/admin/google-play/sync-status', 'GET', undefined, token),
      ]);
      setOverview(data); setSync(refresh ? (data as Overview & { syncStatus?: SyncStatus }).syncStatus || status : status);
      setSelectedPackage(current => current || data.apps[0]?.packageName || '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Google Play data is unavailable.'); }
    finally { setBusy(false); setSyncing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const selectedApp = useMemo(() => overview?.apps.find(app => app.packageName === selectedPackage), [overview, selectedPackage]);
  const loadReviews = useCallback(async () => {
    if (!selectedPackage) return;
    const params = new URLSearchParams({ maxResults: '50' });
    if (reviewToken) params.set('pageToken', reviewToken);
    if (reviewRating !== 'all') params.set('starRating', reviewRating);
    if (reviewSearch.trim()) params.set('search', reviewSearch.trim());
    try { setReviews(await apiRequest<Reviews>(`/admin/google-play/apps/${encodeURIComponent(selectedPackage)}/reviews?${params}`, 'GET', undefined, token)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reviews are unavailable.'); }
  }, [reviewRating, reviewSearch, reviewToken, selectedPackage, token]);
  useEffect(() => { if (tab === 'reviews') void loadReviews(); }, [loadReviews, tab]);
  useEffect(() => {
    if (tab !== 'analytics' || !selectedPackage) return;
    setAnalytics(null);
    void apiRequest<Analytics>(`/admin/google-play/apps/${encodeURIComponent(selectedPackage)}/analytics`, 'GET', undefined, token).then(setAnalytics).catch(cause => setError(cause instanceof Error ? cause.message : 'Analytics are unavailable.'));
  }, [selectedPackage, tab, token]);

  const handleRefresh = () => { setSyncing(true); void load(true); };
  const apps = overview?.apps || [];
  const releases = selectedApp?.tracks.flatMap(track => track.releases.map(release => ({ ...release, track: release.track || track.track }))) || [];

  return <div className="w-full min-w-0 space-y-6">
    <motion.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-divider bg-gradient-to-br from-content1 via-content1 to-primary/[.06] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><MetricIcon name="play" size={24} /></span><div><div className="flex flex-wrap items-center gap-2"><h1 className="!text-3xl font-semibold tracking-tight">Google Play Console</h1>{sync?.configured ? <Chip size="sm" color="success" variant="flat" startContent={<MetricIcon name="check" size={14} />}>Connected</Chip> : <Chip size="sm" color="warning" variant="flat">Setup needed</Chip>}</div><p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">Monitor releases, testing tracks, reviews and supported Play reporting data from the authenticated Android Publisher APIs.</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-default-500">{sync?.lastSyncedAt ? `Synced ${formatDate(sync.lastSyncedAt)}` : 'Not synced yet'}</span><Button color="primary" isLoading={syncing} startContent={!syncing && <MetricIcon name="refresh" />} onPress={handleRefresh}>Sync now</Button></div></div>
    </motion.header>
    {error && <Alert color="danger" variant="flat" title="Google Play request failed" description={error} onClose={() => setError('')} />}
    {!busy && sync && !sync.configured && <Unavailable>{sync.reason || 'Configure the backend service-account JSON and at least one package name before connecting.'}</Unavailable>}
    {busy && !overview ? <LoadingCards /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Configured apps" value={String(overview?.totals.configuredApps ?? 0)} note={`${overview?.totals.appsWithData ?? 0} returned Play data`} icon="apps" /><MetricCard label="Production releases" value={String(overview?.totals.published ?? 0)} note="Completed releases returned by the API" icon="release" tone="success" /><MetricCard label="Draft releases" value={String(overview?.totals.draft ?? 0)} note="Across configured tracks" icon="release" tone="warning" /><MetricCard label="Review / rejection" value={overview?.totals.inReview == null && overview?.totals.rejected == null ? '—' : `${overview?.totals.inReview ?? 0} / ${overview?.totals.rejected ?? 0}`} note="Exact Console review states are not exposed consistently" icon="warning" tone="danger" /></div>
      <Tabs aria-label="Google Play Console views" selectedKey={tab} onSelectionChange={key => setTab(String(key))} color="primary" variant="solid" radius="lg" disableAnimation={Boolean(reduce)} classNames={{ tabList: 'gap-1 border border-divider bg-content1 p-1.5', tab: 'h-11 px-4', tabContent: 'text-xs font-semibold group-data-[selected=true]:text-primary-foreground', cursor: 'bg-primary', panel: 'px-0 pt-6' }}>
        <Tab key="overview" title={<span className="flex items-center gap-2"><MetricIcon name="chart" />Overview</span>}><OverviewPanel apps={apps} notes={overview?.statusNotes || []} /></Tab>
        <Tab key="apps" title={<span className="flex items-center gap-2"><MetricIcon name="apps" />Applications</span>}><ApplicationsPanel apps={apps} selected={selectedPackage} onSelect={packageName => { setSelectedPackage(packageName); setTab('releases'); }} /></Tab>
        <Tab key="releases" title={<span className="flex items-center gap-2"><MetricIcon name="release" />Releases</span>}><ReleasesPanel apps={apps} selectedPackage={selectedPackage} selectedApp={selectedApp} releases={releases} onSelect={setSelectedPackage} /></Tab>
        <Tab key="reviews" title={<span className="flex items-center gap-2"><MetricIcon name="review" />Reviews</span>}><ReviewsPanel apps={apps} selectedPackage={selectedPackage} onSelect={setSelectedPackage} reviews={reviews} search={reviewSearch} rating={reviewRating} onSearch={value => { setReviewToken(''); setReviewSearch(value); }} onRating={value => { setReviewToken(''); setReviewRating(value); }} onNext={() => setReviewToken(reviews?.nextPageToken || '')} /></Tab>
        <Tab key="analytics" title={<span className="flex items-center gap-2"><MetricIcon name="chart" />Analytics</span>}><AnalyticsPanel apps={apps} selectedPackage={selectedPackage} onSelect={setSelectedPackage} analytics={analytics} /></Tab>
        <Tab key="settings" title={<span className="flex items-center gap-2"><MetricIcon name="settings" />Integration</span>}><IntegrationPanel status={sync} /></Tab>
      </Tabs>
    </>}
  </div>;
}

function OverviewPanel({ apps, notes }: { apps: App[]; notes: string[] }) {
  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Release health</h2><p className="text-xs text-default-500">The latest track data returned for each configured package.</p></CardHeader><CardBody className="gap-3 px-6 pb-6">{apps.map(app => <div key={app.packageName} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-divider bg-content2/30 p-4"><div><p className="font-medium">{app.appName}</p><p className="mt-1 font-mono text-xs text-default-500">{app.packageName}</p><StoreStatus app={app} /></div><div className="flex items-center gap-2"><Chip size="sm" color={app.available ? 'success' : 'warning'} variant="flat">{app.available ? 'API data available' : 'Unavailable'}</Chip><Chip size="sm" variant="bordered">{displayRelease(app.latestRelease)}</Chip></div></div>)}{!apps.length && <p className="py-8 text-center text-sm text-default-500">No package names are configured.</p>}</CardBody></Card><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">What the API can confirm</h2><p className="text-xs text-default-500">Limitations are explicit rather than inferred.</p></CardHeader><CardBody className="gap-3 px-6 pb-6">{notes.map(note => <p key={note} className="rounded-xl bg-content2/40 p-3 text-xs leading-5 text-default-500">{note}</p>)}<p className="rounded-xl bg-content2/40 p-3 text-xs leading-5 text-default-500">The dashboard never treats missing reporting data as zero.</p></CardBody></Card></div></div>;
}

function ApplicationsPanel({ apps, selected, onSelect }: { apps: App[]; selected: string; onSelect: (value: string) => void }) {
  return <Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Applications</h2><p className="text-xs text-default-500">Configured packages are read from the backend environment. App names fall back to the package name because the Publisher API does not provide a general catalog endpoint.</p></CardHeader><CardBody className="p-0"><Table aria-label="Google Play applications" removeWrapper classNames={{ th: 'bg-content2/40 text-[11px] uppercase tracking-wide text-default-500', td: 'py-4' }}><TableHeader><TableColumn>APPLICATION</TableColumn><TableColumn>PACKAGE</TableColumn><TableColumn>TRACKS</TableColumn><TableColumn>LATEST VERSION</TableColumn><TableColumn>DATA</TableColumn><TableColumn>ACTION</TableColumn></TableHeader><TableBody emptyContent="No configured applications.">{apps.map(app => <TableRow key={app.packageName}><TableCell><span className="font-medium">{app.appName}</span><StoreStatus app={app} /></TableCell><TableCell><span className="font-mono text-xs">{app.packageName}</span></TableCell><TableCell>{app.tracks.length ? <span className="text-sm">{app.tracks.map(track => track.track).join(', ')}</span> : 'Unavailable'}</TableCell><TableCell>{displayRelease(app.latestRelease)}</TableCell><TableCell><Chip size="sm" color={app.available ? 'success' : 'warning'} variant="flat">{app.available ? 'Available' : 'Unavailable'}</Chip></TableCell><TableCell><Button size="sm" variant={selected === app.packageName ? 'flat' : 'bordered'} color="primary" onPress={() => onSelect(app.packageName)}>Inspect</Button></TableCell></TableRow>)}</TableBody></Table></CardBody></Card>;
}

function ReleasesPanel({ apps, selectedPackage, selectedApp, releases, onSelect }: { apps: App[]; selectedPackage: string; selectedApp?: App; releases: Release[]; onSelect: (value: string) => void }) {
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><Select label="Application" labelPlacement="outside" selectedKeys={selectedPackage ? [selectedPackage] : []} onSelectionChange={keys => onSelect(String(Array.from(keys)[0] || ''))} className="max-w-md" disallowEmptySelection>{apps.map(app => <SelectItem key={app.packageName} textValue={app.packageName}>{app.appName} · {app.packageName}</SelectItem>)}</Select><p className="text-xs text-default-500">Track status is returned by the Android Publisher API. Exact Play Console review approval is not available here.</p></div><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Testing tracks and releases</h2><p className="text-xs text-default-500">{selectedApp?.available ? `${releases.length} release records returned for ${selectedPackage}.` : 'Select an application with available API data.'}</p></CardHeader><CardBody className="p-0">{selectedApp && !selectedApp.available ? <div className="p-6"><Unavailable>{selectedApp.reason || 'Release data is unavailable through the Google Play API.'}</Unavailable></div> : <Table aria-label="Google Play releases" removeWrapper classNames={{ th: 'bg-content2/40 text-[11px] uppercase tracking-wide text-default-500', td: 'py-4 align-top' }}><TableHeader><TableColumn>TRACK</TableColumn><TableColumn>STATUS</TableColumn><TableColumn>VERSION CODES</TableColumn><TableColumn>RELEASE NOTES</TableColumn><TableColumn>COUNTRY / FRACTION</TableColumn></TableHeader><TableBody emptyContent="No releases were returned by Google Play.">{releases.map((release, index) => <TableRow key={`${release.track}-${release.versionCodes.join('-')}-${index}`}><TableCell><Chip size="sm" variant="flat" color={release.track === 'production' ? 'success' : 'primary'}>{release.track}</Chip></TableCell><TableCell><div className="space-y-1"><p className="font-medium capitalize">{release.status}</p><p className="text-[11px] text-default-500">{release.statusSource === 'google_play_api' ? 'Google Play API' : 'Status unavailable through API'}</p></div></TableCell><TableCell><span className="font-mono text-xs">{release.versionCodes.join(', ') || 'Unavailable'}</span></TableCell><TableCell><div className="max-w-xs space-y-1 text-xs">{release.releaseNotes?.slice(0, 2).map(note => <p key={`${note.language}-${note.text}`}><span className="font-medium">{note.language}:</span> {note.text}</p>) || <span className="text-default-500">No notes returned</span>}</div></TableCell><TableCell><span className="text-xs text-default-500">{release.userFraction != null ? `${Math.round(release.userFraction * 100)}% rollout` : release.countryTargeting ? 'Country targeting returned' : 'Not returned'}</span></TableCell></TableRow>)}</TableBody></Table>}</CardBody></Card></div>;
}

function ReviewsPanel({ apps, selectedPackage, onSelect, reviews, search, rating, onSearch, onRating, onNext }: { apps: App[]; selectedPackage: string; onSelect: (value: string) => void; reviews: Reviews | null; search: string; rating: string; onSearch: (value: string) => void; onRating: (value: string) => void; onNext: () => void }) {
  return <div className="space-y-5"><div className="flex flex-wrap items-end gap-3"><Select label="Application" labelPlacement="outside" selectedKeys={selectedPackage ? [selectedPackage] : []} onSelectionChange={keys => onSelect(String(Array.from(keys)[0] || ''))} className="w-full sm:max-w-xs" disallowEmptySelection>{apps.map(app => <SelectItem key={app.packageName}>{app.packageName}</SelectItem>)}</Select><Input label="Search reviews" labelPlacement="outside" value={search} onValueChange={onSearch} className="w-full sm:max-w-xs" placeholder="Text or author" /><Select label="Rating" labelPlacement="outside" selectedKeys={[rating]} onSelectionChange={keys => onRating(String(Array.from(keys)[0] || 'all'))} className="w-full sm:max-w-40" disallowEmptySelection>{['all', '5', '4', '3', '2', '1'].map(value => <SelectItem key={value}>{value === 'all' ? 'All ratings' : `${value} stars`}</SelectItem>)}</Select></div><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Reviews and ratings</h2><p className="text-xs text-default-500">{reviews ? `${reviews.totalRetrieved} reviews retrieved · ${reviews.averageRating == null ? 'Average unavailable' : `${reviews.averageRating.toFixed(2)} / 5 (${reviews.averageLabel})`}` : 'Load a package to read current reviews.'}</p></CardHeader><CardBody className="p-0">{reviews ? <Table aria-label="Google Play reviews" removeWrapper classNames={{ th: 'bg-content2/40 text-[11px] uppercase tracking-wide text-default-500', td: 'py-4 align-top' }}><TableHeader><TableColumn>RATING</TableColumn><TableColumn>REVIEW</TableColumn><TableColumn>VERSION / DATE</TableColumn><TableColumn>DEVELOPER REPLY</TableColumn></TableHeader><TableBody emptyContent="No reviews matched the filters.">{reviews.reviews.map(review => <TableRow key={review.reviewId}><TableCell><Chip size="sm" color={review.starRating && review.starRating >= 4 ? 'success' : 'warning'} variant="flat">{review.starRating ? `${review.starRating} ★` : '—'}</Chip></TableCell><TableCell><div className="max-w-xl"><p className="font-medium">{review.authorName || 'Anonymous'}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-default-500">{review.text || 'No text returned'}</p></div></TableCell><TableCell><span className="text-xs text-default-500">{review.appVersionName || review.appVersionCode || 'Version unavailable'}<br />{formatDate(review.reviewDate)}</span></TableCell><TableCell><span className="text-xs text-default-500">{review.developerReply?.text || 'No developer reply'}</span></TableCell></TableRow>)}</TableBody></Table> : <div className="p-6"><Unavailable>Select an application to load its review feed. API permissions and app availability are required.</Unavailable></div>}<div className="flex justify-end border-t border-divider p-4"><Button size="sm" isDisabled={!reviews?.nextPageToken} onPress={onNext}>Next page</Button></div></CardBody></Card></div>;
}

function AnalyticsPanel({ apps, selectedPackage, onSelect, analytics }: { apps: App[]; selectedPackage: string; onSelect: (value: string) => void; analytics: Analytics | null }) {
  return <div className="space-y-5"><Select label="Application" labelPlacement="outside" selectedKeys={selectedPackage ? [selectedPackage] : []} onSelectionChange={keys => onSelect(String(Array.from(keys)[0] || ''))} className="max-w-md" disallowEmptySelection>{apps.map(app => <SelectItem key={app.packageName}>{app.packageName}</SelectItem>)}</Select><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Play Developer Reporting</h2><p className="text-xs text-default-500">Crash and ANR metric sets are requested for the most recent 30-day window.</p></CardHeader><CardBody>{!analytics ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div> : analytics.available ? <div className="grid gap-4 sm:grid-cols-2"><MetricCard label="Crash rate" value={analytics.crashRate ? 'Returned' : 'Unavailable'} note="Raw Reporting API response is available for inspection." icon="chart" tone="success" /><MetricCard label="ANR rate" value={analytics.anrRate ? 'Returned' : 'Unavailable'} note="Raw Reporting API response is available for inspection." icon="chart" tone="success" /></div> : <Unavailable>{analytics.reason || 'Crash and ANR metrics are unavailable through the Reporting API. Enable the API and grant reporting permissions to the service account.'}</Unavailable>}<p className="mt-5 text-xs leading-5 text-default-500">{analytics?.metricsNote || 'No analytics request has completed yet.'}</p></CardBody></Card></div>;
}

function IntegrationPanel({ status }: { status: SyncStatus | null }) {
  return <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Connection settings</h2><p className="text-xs text-default-500">Only non-secret service-account metadata is shown here.</p></CardHeader><CardBody className="gap-4 px-6 pb-6"><div className="grid gap-4 sm:grid-cols-2"><Info label="Connection" value={status?.configured ? 'Configured' : 'Not configured'} /><Info label="Service account" value={status?.credentials.clientEmail || 'Not available'} /><Info label="Google Cloud project" value={status?.credentials.projectId || 'Not available'} /><Info label="Cache window" value={status ? `${status.cacheTtlSeconds} seconds` : 'Not available'} /></div><Divider /><div><p className="text-xs font-semibold uppercase tracking-wider text-default-500">Configured package names</p><div className="mt-3 flex flex-wrap gap-2">{status?.packageNames.length ? status.packageNames.map(packageName => <Chip key={packageName} variant="flat" className="font-mono">{packageName}</Chip>) : <span className="text-sm text-default-500">None configured</span>}</div></div>{status?.reason && <Unavailable>{status.reason}</Unavailable>}</CardBody></Card><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Required permissions</h2><p className="text-xs text-default-500">Grant these to the backend service account in Google Cloud and Play Console.</p></CardHeader><CardBody className="gap-3 px-6 pb-6">{(status?.scopes || []).map(scope => <p key={scope} className="break-all rounded-xl bg-content2/50 p-3 font-mono text-[11px] text-default-500">{scope}</p>)}<p className="text-xs leading-5 text-default-500">Private keys and access tokens never leave the backend.</p></CardBody></Card></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-divider bg-content2/30 p-4"><p className="text-xs text-default-500">{label}</p><p className="mt-2 break-all text-sm font-medium">{value}</p></div>;
}
