'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Select, SelectItem, Skeleton, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { apiRequest, displayError, readErrorMessage } from '@/lib/api';

type Release = { track: string; status: string; statusSource: string; versionCodes: string[]; name?: string; releaseNotes?: Array<{ language: string; text: string }>; userFraction?: number; countryTargeting?: Record<string, unknown> };
type Track = { track: string; releases: Release[] };
type SubmissionSnapshot = {
  capturedOn: string;
  records: { id: number; submitted: string; areas: string[]; status: string }[];
};
type App = { submissionActivity?: SubmissionSnapshot; lifecycle?: { track: string; reason?: string; releases: {name?: string; state: string; codes: string[]}[] }[]; store?: { subscriptions: "enabled" | "disabled" | "unknown"; production: "published" | "unpublished" | "unknown"; subscriptionReason?: string; productionReason?: string; listingUrl: string | null }; packageName: string; appName: string; nameSource: string; available: boolean; reason?: string; tracks: Track[]; latestRelease?: Release; status: string; statusSource: string };

function StoreStatus({ app }: { app: App }) {
  const store = app.store;
  const missingStatus = 'The connected backend has not reported this status.';
  const subscription = { enabled: 'Enabled', disabled: 'No active plans', unknown: displayError(store?.subscriptionReason, missingStatus) };
  const production = { published: 'Published to production', unpublished: 'No published production release', unknown: displayError(store?.productionReason, missingStatus) };
  const listing = 'https://play.google.com/store/apps/details?id=' + encodeURIComponent(app.packageName);
  return <div className="mt-3 space-y-1 text-xs">
    <p><span className="text-default-500">Subscriptions · </span>{subscription[store?.subscriptions ?? 'unknown']}</p>
    <p><span className="text-default-500">Public availability · </span>{production[store?.production ?? 'unknown']}</p>
    <a className="inline-block py-1 font-medium text-primary underline" href={listing} target="_blank" rel="noopener noreferrer">
      {store?.production === 'published' ? 'View on Google Play' : 'Check Play Store listing'} ↗
    </a>
  </div>;
}
type Overview = { generatedAt: string; apps: App[]; totals: { configuredApps: number; appsWithData: number; appsUnavailable: number; published: number; draft: number; inReview: number | null; rejected: number | null }; statusNotes: string[] };
type SyncStatus = { configured: boolean; credentials: { configured: boolean; clientEmail?: string; projectId?: string }; packageNames: string[]; scopes: string[]; cacheTtlSeconds: number; lastSyncedAt?: string; lastError?: string; reason?: string };
type Review = { reviewId: string; authorName?: string; starRating?: number; text?: string; language?: string; appVersionCode?: string; appVersionName?: string; deviceMetadata?: Record<string, unknown>; reviewDate?: string; developerReply?: { text?: string; date?: string } };
type Reviews = { reviews: Review[]; nextPageToken?: string; totalRetrieved: number; ratingDistribution: Record<string, number>; averageRating: number | null; averageLabel: string };
type MetricSet = { rows?: { startTime?: { year: number; month: number; day: number }; metrics?: { metric: string; decimalValue?: { value?: string } }[] }[] };
type Analytics = { available: boolean; reason?: string; enableReporting?: boolean; crashRate?: MetricSet; anrRate?: MetricSet; metricsNote: string };

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
    let current = true;
    void apiRequest<Analytics>(`/admin/google-play/apps/${encodeURIComponent(selectedPackage)}/analytics`, 'GET', undefined, token)
      .then(data => { if (current) setAnalytics(data); })
      .catch(() => { if (current) setAnalytics({available:false,reason:'Unable to reach analytics. Select Sync now to retry.',metricsNote:''}); });
    return () => { current = false; };
  }, [selectedPackage, tab, token, overview?.generatedAt]);

  const handleRefresh = () => { setSyncing(true); void load(true); };
  const apps = overview?.apps || [];
  const releases = selectedApp?.tracks.flatMap(track => track.releases.map(release => ({ ...release, track: release.track || track.track }))) || [];

  return <div className="w-full min-w-0 space-y-6">
    <motion.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-divider bg-gradient-to-br from-content1 via-content1 to-primary/[.06] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><MetricIcon name="play" size={24} /></span><div><div className="flex flex-wrap items-center gap-2"><h1 className="!text-3xl font-semibold tracking-tight">Google Play Console</h1>{sync?.configured ? <Chip size="sm" color="success" variant="flat" startContent={<MetricIcon name="check" size={14} />}>Connected</Chip> : <Chip size="sm" color="warning" variant="flat">Setup needed</Chip>}</div><p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">Monitor releases, testing tracks, reviews and supported Play reporting data from the authenticated Android Publisher APIs.</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-default-500">{sync?.lastSyncedAt ? `Synced ${formatDate(sync.lastSyncedAt)}` : 'Not synced yet'}</span><Button color="primary" isLoading={syncing} startContent={!syncing && <MetricIcon name="refresh" />} onPress={handleRefresh}>Sync now</Button></div></div>
    </motion.header>
    {error && <Alert color="danger" variant="flat" title="Google Play request failed" description={error} onClose={() => setError('')} />}
    {!busy && sync && !sync.configured && <Unavailable>{displayError(sync.reason, 'Google Play setup is incomplete.')}</Unavailable>}
    {busy && !overview ? <LoadingCards /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Configured apps" value={String(overview?.totals.configuredApps ?? 0)} note={`${overview?.totals.appsWithData ?? 0} returned Play data`} icon="apps" /><MetricCard label="Production releases" value={String(overview?.totals.published ?? 0)} note="Completed releases returned by the API" icon="release" tone="success" /><MetricCard label="Draft releases" value={String(overview?.totals.draft ?? 0)} note="Across configured tracks" icon="release" tone="warning" /><MetricCard label="Review / rejection" value={overview?.totals.inReview == null && overview?.totals.rejected == null ? '—' : `${overview?.totals.inReview ?? 0} / ${overview?.totals.rejected ?? 0}`} note="Apps in review / rejected across monitored tracks" icon="warning" tone="danger" /></div>
      <Tabs aria-label="Google Play Console views" selectedKey={tab} onSelectionChange={key => setTab(String(key))} color="primary" variant="solid" radius="lg" disableAnimation={Boolean(reduce)} classNames={{ tabList: 'gap-1 border border-divider bg-content1 p-1.5', tab: 'h-11 px-4', tabContent: 'text-xs font-semibold group-data-[selected=true]:text-primary-foreground', cursor: 'bg-primary', panel: 'px-0 pt-6' }}>
        <Tab key="overview" title={<span className="flex items-center gap-2"><MetricIcon name="chart" />Overview</span>}><OverviewPanel apps={apps} notes={overview?.statusNotes || []} /></Tab>
        <Tab key="apps" title={<span className="flex items-center gap-2"><MetricIcon name="apps" />Applications</span>}><ApplicationsPanel apps={apps} selected={selectedPackage} onSelect={packageName => { setSelectedPackage(packageName); setTab('releases'); }} /></Tab>
        <Tab key="releases" title={<span className="flex items-center gap-2"><MetricIcon name="release" />Releases</span>}><ReleasesPanel apps={apps} selectedPackage={selectedPackage} selectedApp={selectedApp} releases={releases} onSelect={setSelectedPackage} /><LifecyclePanel app={selectedApp} /></Tab>
        <Tab key="search" title="Store search"><StoreSearch token={token} apps={apps} /></Tab>
        <Tab key="submissions" title="Submission activity">
          <Select label="Application" selectedKeys={selectedPackage ? [selectedPackage] : []} disallowEmptySelection
            onSelectionChange={keys => setSelectedPackage(String(Array.from(keys)[0]))} className="mb-5 max-w-md">
            {apps.map(app => <SelectItem key={app.packageName}>{app.packageName}</SelectItem>)}
          </Select>
          <SubmissionActivity key={selectedPackage} snapshot={selectedApp?.submissionActivity} />
        </Tab>
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
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><Select label="Application" labelPlacement="outside" selectedKeys={selectedPackage ? [selectedPackage] : []} onSelectionChange={keys => onSelect(String(Array.from(keys)[0] || ''))} className="max-w-md" disallowEmptySelection>{apps.map(app => <SelectItem key={app.packageName} textValue={app.packageName}>{app.appName} · {app.packageName}</SelectItem>)}</Select><p className="text-xs text-default-500">Rollout status and review status are reported separately by Google Play.</p></div><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Testing tracks and releases</h2><p className="text-xs text-default-500">{selectedApp?.available ? `${releases.length} release records returned for ${selectedPackage}.` : 'Select an application with available API data.'}</p></CardHeader><CardBody className="p-0">{selectedApp && !selectedApp.available ? <div className="p-6"><Unavailable>{selectedApp.reason || 'Release data is unavailable through the Google Play API.'}</Unavailable></div> : <Table aria-label="Google Play releases" removeWrapper classNames={{ th: 'bg-content2/40 text-[11px] uppercase tracking-wide text-default-500', td: 'py-4 align-top' }}><TableHeader><TableColumn>TRACK</TableColumn><TableColumn>STATUS</TableColumn><TableColumn>VERSION CODES</TableColumn><TableColumn>RELEASE NOTES</TableColumn><TableColumn>COUNTRY / FRACTION</TableColumn></TableHeader><TableBody emptyContent="No releases were returned by Google Play.">{releases.map((release, index) => <TableRow key={`${release.track}-${release.versionCodes.join('-')}-${index}`}><TableCell><Chip size="sm" variant="flat" color={release.track === 'production' ? 'success' : 'primary'}>{release.track}</Chip></TableCell><TableCell><div className="space-y-1"><p className="font-medium capitalize">{release.status}</p><p className="text-[11px] text-default-500">{release.statusSource === 'google_play_api' ? 'Google Play API' : 'Status unavailable through API'}</p></div></TableCell><TableCell><span className="font-mono text-xs">{release.versionCodes.join(', ') || 'Unavailable'}</span></TableCell><TableCell><div className="max-w-xs space-y-1 text-xs">{release.releaseNotes?.slice(0, 2).map(note => <p key={`${note.language}-${note.text}`}><span className="font-medium">{note.language}:</span> {note.text}</p>) || <span className="text-default-500">No notes returned</span>}</div></TableCell><TableCell><span className="text-xs text-default-500">{release.userFraction != null ? `${Math.round(release.userFraction * 100)}% rollout` : release.countryTargeting ? 'Country targeting returned' : 'Not returned'}</span></TableCell></TableRow>)}</TableBody></Table>}</CardBody></Card></div>;
}

function ReviewsPanel({ apps, selectedPackage, onSelect, reviews, search, rating, onSearch, onRating, onNext }: { apps: App[]; selectedPackage: string; onSelect: (value: string) => void; reviews: Reviews | null; search: string; rating: string; onSearch: (value: string) => void; onRating: (value: string) => void; onNext: () => void }) {
  return <div className="space-y-5"><div className="flex flex-wrap items-end gap-3"><Select label="Application" labelPlacement="outside" selectedKeys={selectedPackage ? [selectedPackage] : []} onSelectionChange={keys => onSelect(String(Array.from(keys)[0] || ''))} className="w-full sm:max-w-xs" disallowEmptySelection>{apps.map(app => <SelectItem key={app.packageName}>{app.packageName}</SelectItem>)}</Select><Input label="Search reviews" labelPlacement="outside" value={search} onValueChange={onSearch} className="w-full sm:max-w-xs" placeholder="Text or author" /><Select label="Rating" labelPlacement="outside" selectedKeys={[rating]} onSelectionChange={keys => onRating(String(Array.from(keys)[0] || 'all'))} className="w-full sm:max-w-40" disallowEmptySelection>{['all', '5', '4', '3', '2', '1'].map(value => <SelectItem key={value}>{value === 'all' ? 'All ratings' : `${value} stars`}</SelectItem>)}</Select></div><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Reviews and ratings</h2><p className="text-xs text-default-500">{reviews ? `${reviews.totalRetrieved} reviews retrieved · ${reviews.averageRating == null ? 'Average unavailable' : `${reviews.averageRating.toFixed(2)} / 5 (${reviews.averageLabel})`}` : 'Load a package to read current reviews.'}</p></CardHeader><CardBody className="p-0">{reviews ? <Table aria-label="Google Play reviews" removeWrapper classNames={{ th: 'bg-content2/40 text-[11px] uppercase tracking-wide text-default-500', td: 'py-4 align-top' }}><TableHeader><TableColumn>RATING</TableColumn><TableColumn>REVIEW</TableColumn><TableColumn>VERSION / DATE</TableColumn><TableColumn>DEVELOPER REPLY</TableColumn></TableHeader><TableBody emptyContent="No reviews matched the filters.">{reviews.reviews.map(review => <TableRow key={review.reviewId}><TableCell><Chip size="sm" color={review.starRating && review.starRating >= 4 ? 'success' : 'warning'} variant="flat">{review.starRating ? `${review.starRating} ★` : '—'}</Chip></TableCell><TableCell><div className="max-w-xl"><p className="font-medium">{review.authorName || 'Anonymous'}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-default-500">{review.text || 'No text returned'}</p></div></TableCell><TableCell><span className="text-xs text-default-500">{review.appVersionName || review.appVersionCode || 'Version unavailable'}<br />{formatDate(review.reviewDate)}</span></TableCell><TableCell><span className="text-xs text-default-500">{review.developerReply?.text || 'No developer reply'}</span></TableCell></TableRow>)}</TableBody></Table> : <div className="p-6"><Unavailable>Select an application to load its review feed. API permissions and app availability are required.</Unavailable></div>}<div className="flex justify-end border-t border-divider p-4"><Button size="sm" isDisabled={!reviews?.nextPageToken} onPress={onNext}>Next page</Button></div></CardBody></Card></div>;
}

function AnalyticsPanel({ apps, selectedPackage, onSelect, analytics }: { apps: App[]; selectedPackage: string; onSelect: (value: string) => void; analytics: Analytics | null }) {
  const app = apps.find(item => item.packageName === selectedPackage);
  return <div className="space-y-5">
    <Select label="Application" labelPlacement="outside" selectedKeys={selectedPackage ? [selectedPackage] : []} onSelectionChange={keys => onSelect(String(Array.from(keys)[0] || ''))} className="max-w-md" disallowEmptySelection>
      {apps.map(item => <SelectItem key={item.packageName}>{item.packageName}</SelectItem>)}
    </Select>
    {app && <StoreStatus app={app} />}
    <Card shadow="none" className="border border-divider">
      <CardHeader><h2 className="text-lg font-semibold">Android vitals · last 30 days</h2></CardHeader>
      <CardBody className="gap-4">
        {!analytics && <Skeleton className="h-28 rounded-2xl" />}
        {analytics?.reason && <Unavailable>{displayError(analytics.reason, 'Analytics are temporarily unavailable.')}{analytics.enableReporting && (
          <a href="https://console.cloud.google.com/apis/library/playdeveloperreporting.googleapis.com" target="_blank" rel="noopener noreferrer" className="ml-2 underline">Open API settings ↗</a>
        )}</Unavailable>}
        {analytics?.available && <div className="grid gap-4 sm:grid-cols-2">
          {(['crashRate','anrRate'] as const).map(key => {
            const set = analytics[key];
            const points = (set?.rows ?? []).flatMap(row => {
              const date = row.startTime;
              const value = row.metrics?.find(metric => metric.metric === key)?.decimalValue?.value;
              if (!date || value == null) return [];
              return [{ day: [date.year, String(date.month).padStart(2,'0'), String(date.day).padStart(2,'0')].join('-'), value }];
            }).sort((a,b) => b.day.localeCompare(a.day));
            const latest = points[0];
            return <MetricCard key={key} label={key === 'crashRate' ? 'Crash rate' : 'ANR rate'} icon="chart"
              value={latest ? latest.value + '%' : '—'} note={latest ? 'Latest daily rate · ' + latest.day : set ? 'No daily samples returned' : 'Metric unavailable'} />;
          })}
        </div>}
      </CardBody>
    </Card>
  </div>;
}

function IntegrationPanel({ status }: { status: SyncStatus | null }) {
  return <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Connection settings</h2><p className="text-xs text-default-500">Only non-secret service-account metadata is shown here.</p></CardHeader><CardBody className="gap-4 px-6 pb-6"><div className="grid gap-4 sm:grid-cols-2"><Info label="Connection" value={status?.configured ? 'Configured' : 'Not configured'} /><Info label="Service account" value={status?.credentials.clientEmail || 'Not available'} /><Info label="Google Cloud project" value={status?.credentials.projectId || 'Not available'} /><Info label="Cache window" value={status ? `${status.cacheTtlSeconds} seconds` : 'Not available'} /></div><Divider /><div><p className="text-xs font-semibold uppercase tracking-wider text-default-500">Configured package names</p><div className="mt-3 flex flex-wrap gap-2">{status?.packageNames.length ? status.packageNames.map(packageName => <Chip key={packageName} variant="flat" className="font-mono">{packageName}</Chip>) : <span className="text-sm text-default-500">None configured</span>}</div></div>{status?.reason && <Unavailable>{displayError(status.reason, 'Google Play setup is incomplete.')}</Unavailable>}</CardBody></Card><Card shadow="none" className="border border-divider"><CardHeader className="flex-col items-start gap-1 px-6 pt-6"><h2 className="text-lg font-semibold">Required permissions</h2><p className="text-xs text-default-500">Grant these to the backend service account in Google Cloud and Play Console.</p></CardHeader><CardBody className="gap-3 px-6 pb-6">{(status?.scopes || []).map(scope => <p key={scope} className="break-all rounded-xl bg-content2/50 p-3 font-mono text-[11px] text-default-500">{scope}</p>)}<p className="text-xs leading-5 text-default-500">Private keys and access tokens never leave the backend.</p></CardBody></Card></div>;
}

type StoreListing = { packageName: string; title: string; summary: string; url: string };

function StoreSearch({ token, apps }: { token: string; apps: App[] }) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<StoreListing[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const monitored = apps.filter(app => {
    if (!query) return false;
    if (query.startsWith('https://')) {
      try {
        const link = new URL(query);
        return link.origin === 'https://play.google.com' && link.pathname === '/store/apps/details' && link.searchParams.get('id') === app.packageName;
      } catch { return false; }
    }
    return (app.packageName + ' ' + app.appName).toLowerCase().includes(query.toLowerCase());
  });
  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !input.trim()) return;
    setLoading(true); setItems(null); setError(''); setQuery(input.trim());
    try {
      const response = await fetch('/api/admin/play-search?' + new URLSearchParams({ q: input.trim() }), {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(readErrorMessage(data, response.status));
      } else if (Array.isArray(data.items)) {
        setItems(data.items);
      } else {
        setError('Store search returned an unexpected response. Try again.');
      }
    } catch {
      setError('Store search is unavailable. Try again.');
    } finally { setLoading(false); }
  }
  return <Card shadow="none" className="border border-divider"><CardBody className="gap-4 p-5">
    <h2 className="text-lg font-semibold">Search Google Play</h2>
    <form onSubmit={search} className="flex flex-wrap items-end gap-2">
      <Input label="App name, keyword, package or Play Store link" value={input} onValueChange={setInput}
        maxLength={2048} className="min-w-48 flex-1" />
      <Button type="submit" color="primary" isLoading={loading} isDisabled={!input.trim() || loading}>Search</Button>
    </form>
    {monitored.length > 0 && <section aria-label="Monitored applications">
      <h3 className="text-sm font-semibold">Monitored applications</h3>
      {monitored.map(app => <div key={app.packageName} className="py-2">
        <p>{app.appName}</p><p className="break-all text-xs text-default-500">{app.packageName}</p>
        <StoreStatus app={app} />
      </div>)}
    </section>}
    <div role="status" className="text-sm text-default-500">{loading ? 'Searching Google Play…' : error || (items &&
      (items.length ? `${items.length} indexed Google Play results for “${query}”` : `No indexed listings found for “${query}”.`))}</div>
    {items && items.length > 0 && <ul className="divide-y divide-divider">{items.map(item => <li key={item.packageName} className="py-3">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{item.title}</a>
      <p className="break-all text-xs text-default-500">{item.packageName}</p>
      {item.summary && <p className="mt-1 text-sm">{item.summary}</p>}
    </li>)}</ul>}
  </CardBody></Card>;
}

function SubmissionActivity({ snapshot }: { snapshot?: SubmissionSnapshot }) {
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [query, setQuery] = useState('');
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const records = snapshot?.records ?? [];
  const filtered = records.filter(row => {
    const text = [`#${row.id}`, row.submitted, row.status, ...row.areas].join(' ').toLowerCase();
    return (!status || row.status === status) && (!area || row.areas.includes(area)) && terms.every(term => text.includes(term));
  });
  return <Card shadow="none" className="border border-divider">
    <CardHeader className="flex-col items-start gap-2 p-5">
      <h2 className="text-lg font-semibold">Submission activity</h2>
      <p className="text-xs text-default-500">{snapshot
        ? `Play Console snapshot · ${snapshot.capturedOn}. Times are shown as recorded. Check Play Console for subsequent changes.`
        : 'No submission history has been imported for this application.'}</p>
    </CardHeader>
    {snapshot && <CardBody className="gap-4 p-5 pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Search submission activity" placeholder="Search submissions" size="sm" className="max-w-64"
          isClearable value={query} onValueChange={setQuery} onClear={() => setQuery('')} />
        <Select aria-label="Filter submissions by status" size="sm" className="max-w-52" selectedKeys={[status || 'all']} disallowEmptySelection
          onSelectionChange={keys => { const key = String(Array.from(keys)[0]); setStatus(key === 'all' ? '' : key); }}>
          {['all', ...new Set(records.map(row => row.status))].map(key => <SelectItem key={key}>{key === 'all' ? 'All statuses' : key}</SelectItem>)}
        </Select>
        <Select aria-label="Filter submissions by area" size="sm" className="max-w-52" selectedKeys={[area || 'all']} disallowEmptySelection
          onSelectionChange={keys => { const key = String(Array.from(keys)[0]); setArea(key === 'all' ? '' : key); }}>
          {['all', ...new Set(records.flatMap(row => row.areas))].map(key => <SelectItem key={key}>{key === 'all' ? 'All areas' : key}</SelectItem>)}
        </Select>
        <span className="text-xs text-default-500" aria-live="polite">{filtered.length} of {records.length} submissions</span>
      </div>
      <div className="overflow-x-auto"><Table aria-label="Submission activity" removeWrapper>
        <TableHeader><TableColumn>ID</TableColumn><TableColumn>SUBMITTED</TableColumn><TableColumn>CHANGES</TableColumn><TableColumn>STATUS</TableColumn></TableHeader>
        <TableBody emptyContent="No submissions match these filters.">{filtered.map(row => <TableRow key={row.id}>
          <TableCell>#{row.id}</TableCell><TableCell>{row.submitted}</TableCell><TableCell>{row.areas.join(', ')}</TableCell>
          <TableCell><Chip size="sm" variant="flat" color={row.status === 'In review' ? 'warning' : row.status === 'Published' ? 'success' : 'default'}>{row.status}</Chip></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
    </CardBody>}
  </Card>;
}

function LifecyclePanel({ app }: { app?: App }) {
  if (!app?.lifecycle?.length) return null;
  return <section className="mt-5 space-y-3">
    <h2 className="text-lg font-semibold">Release review status</h2>
    <div className="grid gap-3 md:grid-cols-2">
      {app.lifecycle.map(track => <Card key={track.track} shadow="none" className="border border-divider">
        <CardBody className="gap-2 p-4">
          <h3 className="font-medium">{track.track}</h3>
          {track.reason && <p className="text-xs text-warning">{displayError(track.reason, 'Track information is unavailable.')}</p>}
          {!track.reason && !track.releases.length && <p className="text-xs text-default-500">No current releases.</p>}
          {track.releases.map((release, i) => <div key={i} className="flex flex-wrap justify-between gap-2 text-sm">
            <span>{release.name || 'Unnamed release'} {release.codes.length > 0 && <small>· {release.codes.join(', ')}</small>}</span>
            <Chip size="sm" variant="flat">{release.state.replace(/^RELEASE_LIFECYCLE_STATE_/, '').replaceAll('_', ' ').toLowerCase()}</Chip>
          </div>)}
        </CardBody>
      </Card>)}
    </div>
  </section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-divider bg-content2/30 p-4"><p className="text-xs text-default-500">{label}</p><p className="mt-2 break-all text-sm font-medium">{value}</p></div>;
}
