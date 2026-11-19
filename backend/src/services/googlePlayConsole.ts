import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import { BadRequestError, AppError } from '../utils/errors';

const ANDROID_PUBLISHER_ORIGIN = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const REPORTING_ORIGIN = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const ANDROID_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const REPORTING_SCOPE = 'https://www.googleapis.com/auth/playdeveloperreporting';
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const packagePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9_]*\.)+[a-zA-Z0-9_]+$/;

type JsonRecord = Record<string, unknown>;

export type GooglePlayRelease = {
  track: string;
  status: string;
  statusSource: 'google_play_api' | 'unavailable_through_api';
  versionCodes: string[];
  name?: string;
  releaseNotes: Array<{ language: string; text: string }>;
  userFraction?: number;
  countryTargeting?: JsonRecord;
};

export type GooglePlayTrack = {
  track: string;
  releases: GooglePlayRelease[];
};

export type GooglePlayApp = {
  store: {
    subscriptions: 'enabled' | 'disabled' | 'unknown';
    production: 'published' | 'unpublished' | 'unknown';
    listingUrl: string | null;
    subscriptionReason?: string;
    productionReason?: string;
  };
  packageName: string;
  appName: string;
  nameSource: 'package_name';
  available: boolean;
  reason?: string;
  tracks: GooglePlayTrack[];
  latestRelease?: GooglePlayRelease;
  status: 'available' | 'unavailable_through_api';
  statusSource: 'google_play_api' | 'unavailable_through_api';
};

export type GooglePlayReview = {
  reviewId: string;
  authorName?: string;
  starRating?: number;
  text?: string;
  language?: string;
  appVersionCode?: string;
  appVersionName?: string;
  deviceMetadata?: JsonRecord;
  reviewDate?: string;
  developerReply?: { text?: string; date?: string };
};

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();
let lastSyncAt: string | undefined;
let lastSyncError: string | undefined;

function cacheTtlMs(): number {
  const seconds = Number(process.env.GOOGLE_PLAY_CONSOLE_CACHE_TTL_SECONDS);
  if (Number.isSafeInteger(seconds) && seconds > 0) return Math.min(seconds, 3600) * 1000;
  return DEFAULT_CACHE_TTL_MS;
}

function getCached<T>(key: string): T | undefined {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return item.value as T;
}

function putCached<T>(key: string, value: T): T {
  cache.set(key, { expiresAt: Date.now() + cacheTtlMs(), value });
  return value;
}

export function parseGooglePlayPackageNames(value = process.env.GOOGLE_PLAY_PACKAGE_NAMES || process.env.GOOGLE_PLAY_PACKAGE_NAME || '') : string[] {
  return [...new Set(value.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean))]
    .filter(item => packagePattern.test(item));
}

export function maskServiceAccountEmail(email: unknown): string | undefined {
  if (typeof email !== 'string' || !email.includes('@')) return undefined;
  const [name, domain] = email.split('@');
  if (!name || !domain) return undefined;
  return `${name.slice(0, 2)}${name.length > 2 ? '…' : ''}@${domain}`;
}

export function normalizeReleaseStatus(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Status unavailable through API';
  const status = value.trim();
  if (status === 'inProgress') return 'in progress';
  return status;
}

function readCredentials(): JsonRecord | undefined {
  const configured = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  const candidates = configured
    ? [configured]
    : [
      path.resolve(process.cwd(), 'credentials/google-play-service-account.json'),
      path.resolve(__dirname, '../../credentials/google-play-service-account.json'),
    ];
  for (const candidate of candidates) {
    try {
      const raw = candidate.startsWith('{') ? candidate : fs.readFileSync(candidate, 'utf8');
      const value = JSON.parse(raw) as unknown;
      if (value && typeof value === 'object') {
        const record = value as JsonRecord;
        if (typeof record.client_email === 'string' && typeof record.private_key === 'string') return record;
      }
    } catch {
      // Configuration status is surfaced to the admin UI; secrets are never included in the error.
    }
  }
  return undefined;
}

function credentialStatus(): { configured: boolean; clientEmail?: string; projectId?: string; reason?: string } {
  const credentials = readCredentials();
  if (!credentials) return { configured: false, reason: 'Google Play service-account JSON is missing or invalid.' };
  return {
    configured: true,
    clientEmail: typeof credentials.client_email === 'string' ? credentials.client_email : undefined,
    projectId: typeof credentials.project_id === 'string' ? credentials.project_id : undefined,
  };
}

let auth: GoogleAuth | undefined;
let authFingerprint = '';
function getAuth(): GoogleAuth {
  const credentials = readCredentials();
  if (!credentials) throw new AppError('Google Play service-account JSON is missing or invalid.', 503);
  const fingerprint = `${String(credentials.client_email)}:${String(credentials.project_id)}`;
  if (!auth || authFingerprint !== fingerprint) {
    auth = new GoogleAuth({ credentials: credentials as never, scopes: [ANDROID_SCOPE, REPORTING_SCOPE] });
    authFingerprint = fingerprint;
  }
  return auth;
}

async function accessToken(): Promise<string> {
  const client = await getAuth().getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new AppError('Google Play access token could not be created. Check service-account permissions.', 503);
  return token.token;
}

function publicGoogleError(status: number, detail: string): Error {
  if (status === 401 || status === 403) return new AppError('Google Play API denied access. Grant the service account Play Console permissions for this app and API.', 502);
  if (status === 404) return new AppError('Google Play API could not find this package or resource.', 404);
  if (status === 429) return new AppError('Google Play API rate limit reached. Try again after the cache window.', 429);
  return new AppError(`Google Play API request failed (${status}). ${detail}`, 502);
}

async function googleFetch<T>(origin: string, requestPath: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${origin}${requestPath}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!response.ok) {
    const apiMessage = parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as JsonRecord).error === 'object'
      ? String(((parsed as JsonRecord).error as JsonRecord).message || '')
      : '';
    throw Object.assign(publicGoogleError(response.status, apiMessage || 'The provider returned an error.'), { googleStatus: response.status });
  }
  return parsed as T;
}

function packageOrThrow(packageName: string): string {
  if (!packagePattern.test(packageName)) throw new BadRequestError('Invalid Android package name.');
  const allowed = parseGooglePlayPackageNames();
  if (!allowed.includes(packageName)) throw new BadRequestError('This package is not configured for Google Play monitoring.');
  return packageName;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function normalizeRelease(track: string, raw: JsonRecord): GooglePlayRelease {
  const notes = Array.isArray(raw.releaseNotes) ? raw.releaseNotes : [];
  return {
    track,
    status: normalizeReleaseStatus(raw.status),
    statusSource: typeof raw.status === 'string' ? 'google_play_api' : 'unavailable_through_api',
    versionCodes: Array.isArray(raw.versionCodes) ? raw.versionCodes.map(asString).filter((item): item is string => Boolean(item)) : [],
    name: asString(raw.name),
    releaseNotes: notes.map(item => {
      const note = (item && typeof item === 'object' ? item : {}) as JsonRecord;
      return { language: asString(note.language) || 'unknown', text: asString(note.text) || '' };
    }).filter(item => item.text),
    userFraction: asNumber(raw.userFraction),
    countryTargeting: raw.countryTargeting && typeof raw.countryTargeting === 'object' ? raw.countryTargeting as JsonRecord : undefined,
  };
}

async function fetchTracks(packageName: string): Promise<GooglePlayTrack[]> {
  const edit = await googleFetch<JsonRecord>(ANDROID_PUBLISHER_ORIGIN, `/applications/${encodeURIComponent(packageName)}/edits`, { method: 'POST', body: '{}' });
  const editId = asString(edit.id);
  if (!editId) throw new AppError('Google Play returned an edit without an ID.', 502);
  try {
    const result = await googleFetch<JsonRecord>(ANDROID_PUBLISHER_ORIGIN, `/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}/tracks`);
    const tracks = Array.isArray(result.tracks) ? result.tracks : [];
    return tracks.map(item => {
      const raw = (item && typeof item === 'object' ? item : {}) as JsonRecord;
      const track = asString(raw.track) || 'unknown';
      const releases = Array.isArray(raw.releases) ? raw.releases.map(value => normalizeRelease(track, (value && typeof value === 'object' ? value : {}) as JsonRecord)) : [];
      return { track, releases };
    });
  } finally {
    try { await googleFetch<JsonRecord>(ANDROID_PUBLISHER_ORIGIN, `/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}`, { method: 'DELETE' }); } catch { /* cleanup failure does not hide the real read result */ }
  }
}

function latestRelease(tracks: GooglePlayTrack[]): GooglePlayRelease | undefined {
  const priority = ['production', 'beta', 'alpha', 'internal'];
  const all = tracks.flatMap(track => track.releases);
  return all.sort((a, b) => (priority.indexOf(a.track) < 0 ? 99 : priority.indexOf(a.track)) - (priority.indexOf(b.track) < 0 ? 99 : priority.indexOf(b.track)))[0];
}

export async function getConnectionStatus() {
  const credentials = credentialStatus();
  const packages = parseGooglePlayPackageNames();
  return {
    configured: credentials.configured && packages.length > 0,
    credentials: { configured: credentials.configured, clientEmail: maskServiceAccountEmail(credentials.clientEmail), projectId: credentials.projectId },
    packageNames: packages,
    scopes: [ANDROID_SCOPE, REPORTING_SCOPE],
    cacheTtlSeconds: Math.round(cacheTtlMs() / 1000),
    lastSyncedAt: lastSyncAt,
    lastError: lastSyncError,
    reason: !credentials.configured ? credentials.reason : packages.length === 0 ? 'Set GOOGLE_PLAY_PACKAGE_NAMES or GOOGLE_PLAY_PACKAGE_NAME.' : undefined,
  };
}

type SubscriptionPage = {
  subscriptions?: { basePlans?: { state?: string }[] }[];
  nextPageToken?: string;
};

async function subscriptionStatus(base: string): Promise<GooglePlayApp['store']['subscriptions']> {
  const query = new URLSearchParams({ pageSize: '100' });
  const seen = new Set<string>();
  let uncertain = false;
  for (;;) {
    const page = await googleFetch<SubscriptionPage | null>(ANDROID_PUBLISHER_ORIGIN, base + '/subscriptions?' + query, { signal: AbortSignal.timeout(8000) });
    if (!page) throw new StoreCheckError('Google returned no subscription catalog.');
    for (const product of page.subscriptions ?? []) {
      for (const plan of product.basePlans ?? []) {
        if (plan.state === 'ACTIVE') return 'enabled';
        if (plan.state !== 'DRAFT' && plan.state !== 'INACTIVE') uncertain = true;
      }
    }
    if (!page.nextPageToken) return uncertain ? 'unknown' : 'disabled';
    if (seen.has(page.nextPageToken)) throw new StoreCheckError('Google returned an incomplete subscription catalog.');
    seen.add(page.nextPageToken);
    query.set('pageToken', page.nextPageToken);
  }
}

async function productionStatus(base: string): Promise<GooglePlayApp['store']['production']> {
  const data = await googleFetch<{ releases?: { releaseLifecycleState?: string }[] } | null>(
    ANDROID_PUBLISHER_ORIGIN, base + '/tracks/production/releases', { signal: AbortSignal.timeout(8000) },
  );
  if (!data) throw new StoreCheckError('Google returned no production release data.');
  const states = (data.releases ?? []).map(release => release.releaseLifecycleState);
  if (states.includes('RELEASE_LIFECYCLE_STATE_PUBLISHED')) return 'published';
  const pending = ['DRAFT', 'NOT_SENT_FOR_REVIEW', 'IN_REVIEW', 'APPROVED_NOT_PUBLISHED', 'NOT_APPROVED'];
  return states.every(state => pending.some(s => state === 'RELEASE_LIFECYCLE_STATE_' + s)) ? 'unpublished' : 'unknown';
}

class StoreCheckError extends Error {}

function checkFailure(error: unknown) {
  if (error instanceof StoreCheckError) return error.message;
  const status = error && typeof error === 'object' && 'googleStatus' in error ? error.googleStatus : null;
  switch (status) {
    case 401: return 'Google rejected the backend credentials.';
    case 403: return 'Google denied this request. Check API enablement and app permissions.';
    case 404: return 'Google could not find this resource for the configured package.';
    case 429: return 'Google rate limited this request. Retry sync later.';
    default: return 'The backend could not complete this Google Play request. Retry sync.';
  }
}

export async function getStoreAvailability(packageName: string): Promise<GooglePlayApp['store']> {
  const pkg = packageOrThrow(packageName);
  const base = '/applications/' + encodeURIComponent(pkg);
  const [catalog, track] = await Promise.allSettled([
    subscriptionStatus(base),
    productionStatus(base),
  ]);
  const subscriptions = catalog.status === 'fulfilled' ? catalog.value : 'unknown';
  const production = track.status === 'fulfilled' ? track.value : 'unknown';
  return {
    subscriptions, production,
    ...(subscriptions === 'unknown' && { subscriptionReason: catalog.status === 'rejected' ? checkFailure(catalog.reason) : 'Google returned an unspecified base plan state.' }),
    ...(production === 'unknown' && { productionReason: track.status === 'rejected' ? checkFailure(track.reason) : 'Google returned an unspecified production release state.' }),
    listingUrl: production === 'published' ? 'https://play.google.com/store/apps/details?id=' + encodeURIComponent(pkg) : null,
  };
}

export async function getApp(packageName: string): Promise<GooglePlayApp> {
  const pkg = packageOrThrow(packageName);
  const key = `app:${pkg}`;
  const cached = getCached<GooglePlayApp>(key);
  if (cached) return cached;
  const store = getStoreAvailability(pkg);
  try {
    const tracks = await fetchTracks(pkg);
    return putCached(key, { store: await store, packageName: pkg, appName: pkg, nameSource: 'package_name', available: true, tracks, latestRelease: latestRelease(tracks), status: 'available', statusSource: 'google_play_api' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Google Play data is unavailable.';
    return putCached(key, { store: await store, packageName: pkg, appName: pkg, nameSource: 'package_name', available: false, reason, tracks: [], status: 'unavailable_through_api', statusSource: 'unavailable_through_api' });
  }
}

export async function getApps(): Promise<GooglePlayApp[]> {
  const key = 'apps';
  const cached = getCached<GooglePlayApp[]>(key);
  if (cached) return cached;
  const apps = await Promise.all(parseGooglePlayPackageNames().map(packageName => getApp(packageName)));
  return putCached(key, apps);
}

export async function getOverview() {
  const apps = await getApps();
  const available = apps.filter(app => app.available);
  const releases = available.flatMap(app => app.tracks.flatMap(track => track.releases));
  const production = releases.filter(release => release.track === 'production');
  return {
    generatedAt: new Date().toISOString(),
    apps,
    totals: {
      configuredApps: apps.length,
      appsWithData: available.length,
      appsUnavailable: apps.length - available.length,
      published: production.filter(release => release.status === 'completed').length,
      draft: releases.filter(release => release.status === 'draft').length,
      inReview: null,
      rejected: null,
    },
    statusNotes: ['Review and approval status are not exposed consistently by the Android Publisher API; unavailable values are shown as null.'],
  };
}

export async function getReleases(packageName: string): Promise<{ packageName: string; tracks: GooglePlayTrack[]; fetchedAt: string; available: boolean; reason?: string }> {
  const app = await getApp(packageName);
  return { packageName: app.packageName, tracks: app.tracks, fetchedAt: new Date().toISOString(), available: app.available, reason: app.reason };
}

function normalizeDate(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as JsonRecord;
  const seconds = asNumber(record.seconds);
  return seconds == null ? undefined : new Date(seconds * 1000).toISOString();
}

function ratingNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const match = value.match(/(?:STAR_RATING_)?([1-5])/i);
  return match ? Number(match[1]) : undefined;
}

export async function getReviews(packageName: string, options: { pageToken?: string; maxResults?: number; starRating?: number; search?: string } = {}) {
  const pkg = packageOrThrow(packageName);
  const maxResults = Math.max(1, Math.min(100, Math.floor(options.maxResults || 20)));
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (options.pageToken && options.pageToken.length <= 1024) params.set('token', options.pageToken);
  const result = await googleFetch<JsonRecord>(ANDROID_PUBLISHER_ORIGIN, `/applications/${encodeURIComponent(pkg)}/reviews?${params.toString()}`);
  const rawReviews = Array.isArray(result.reviews) ? result.reviews : [];
  const reviews: GooglePlayReview[] = rawReviews.map(item => {
    const raw = (item && typeof item === 'object' ? item : {}) as JsonRecord;
    const comments = Array.isArray(raw.comments) ? raw.comments : [];
    const user = (comments.find(comment => comment && typeof comment === 'object' && 'userComment' in (comment as JsonRecord)) as JsonRecord | undefined)?.userComment as JsonRecord | undefined;
    const developer = (comments.find(comment => comment && typeof comment === 'object' && 'developerComment' in (comment as JsonRecord)) as JsonRecord | undefined)?.developerComment as JsonRecord | undefined;
    return {
      reviewId: asString(raw.reviewId) || 'unknown',
      authorName: asString(raw.authorName),
      starRating: ratingNumber(user?.starRating),
      text: asString(user?.text),
      language: asString(user?.reviewerLanguage),
      appVersionCode: asString(user?.appVersionCode),
      appVersionName: asString(user?.appVersionName),
      deviceMetadata: user?.deviceMetadata && typeof user.deviceMetadata === 'object' ? user.deviceMetadata as JsonRecord : undefined,
      reviewDate: normalizeDate(user?.lastModified),
      developerReply: developer ? { text: asString(developer.text), date: normalizeDate(developer.lastModified) } : undefined,
    };
  }).filter(review => !options.starRating || review.starRating === options.starRating)
    .filter(review => !options.search || `${review.text || ''} ${review.authorName || ''}`.toLowerCase().includes(options.search.toLowerCase()));
  const distribution = reviews.reduce<Record<string, number>>((result, review) => { if (review.starRating) result[String(review.starRating)] = (result[String(review.starRating)] || 0) + 1; return result; }, {});
  const rated = reviews.filter(review => review.starRating).map(review => review.starRating as number);
  return { packageName: pkg, reviews, nextPageToken: asString(result.tokenPagination && (result.tokenPagination as JsonRecord).nextPageToken), totalRetrieved: reviews.length, ratingDistribution: distribution, averageRating: rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : null, averageLabel: 'Average of retrieved reviews only' };
}

function reportingWindow(): { startTime: JsonRecord; endTime: JsonRecord } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const asTimestamp = (date: Date) => ({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
  return { startTime: asTimestamp(start), endTime: asTimestamp(end) };
}

async function queryReporting(packageName: string, metricSet: string, metric: string): Promise<unknown> {
  const window = reportingWindow();
  return googleFetch<JsonRecord>(REPORTING_ORIGIN, `/apps/${encodeURIComponent(packageName)}/${metricSet}:query`, { method: 'POST', body: JSON.stringify({ timelineSpec: { aggregationPeriod: 'DAILY', startTime: window.startTime, endTime: window.endTime }, dimensions: [], metrics: [metric] }) });
}

export async function getAnalytics(packageName: string) {
  const pkg = packageOrThrow(packageName);
  const results: { crashRate?: unknown; anrRate?: unknown; available: boolean; reason?: string } = { available: false };
  try {
    results.crashRate = await queryReporting(pkg, 'crashRateMetricSet', 'crashRate');
    results.available = true;
  } catch (error) {
    results.reason = error instanceof Error ? error.message : 'Crash metrics are unavailable through the Reporting API.';
  }
  try {
    results.anrRate = await queryReporting(pkg, 'anrRateMetricSet', 'anrRate');
    results.available = true;
  } catch (error) {
    if (!results.reason) results.reason = error instanceof Error ? error.message : 'ANR metrics are unavailable through the Reporting API.';
  }
  return { packageName: pkg, ...results, metricsNote: 'Only metrics returned by Google Play Developer Reporting API are shown. Unavailable metrics are not treated as zero.' };
}

export function clearGooglePlayCache(): void {
  cache.clear();
  lastSyncAt = undefined;
  lastSyncError = undefined;
}

export async function syncGooglePlay() {
  clearGooglePlayCache();
  try {
    const overview = await getOverview();
    lastSyncAt = overview.generatedAt;
    return { ...overview, syncStatus: await getConnectionStatus() };
  } catch (error) {
    lastSyncError = error instanceof Error ? error.message : 'Google Play synchronization failed.';
    throw error;
  }
}
