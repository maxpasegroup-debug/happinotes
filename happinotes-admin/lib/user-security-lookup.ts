// Server-only use: imported by the authenticated Next route, never by UI code.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Reader } from 'mmdb-lib';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import type { DevicePhoto, SecurityGeo, SecurityUser } from './user-security';

const clean = (value: unknown, max = 100): string => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max) : '';
export function publicIp(value: unknown): string | undefined {
  const ip = clean(value, 80).toLowerCase().replace(/^::ffff:/, '');
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return undefined;
    return ip;
  }
  // Only global-unicast IPv6; exclude documentation addresses as well.
  if (isIP(ip) === 6 && /^[23][a-f0-9]{0,3}:/i.test(ip) && !/^2001:0?db8:/i.test(ip)) return ip;
  return undefined;
}
const geoCache = new Map<string, { expires: number; value: SecurityGeo }>();
const photoCache = new Map<string, { expires: number; value: DevicePhoto; checkedAt?: number }>();
const pendingGeo = new Map<string, Promise<SecurityGeo>>();
const pendingPhotos = new Map<string, Promise<DevicePhoto>>();
function cache<T>(map: Map<string, { expires: number; value: T }>, key: string, value: T, ttl: number) {
  if (map.size >= 500) map.delete(map.keys().next().value!);
  map.set(key, { value, expires: Date.now() + ttl });
}
type GeoSource = 'ipapi.co' | 'ipwho.is';
const providerBackoff = new Map<string, { until: number; status: string }>();
const sourceKey = (source: GeoSource) => `${source}:${source === 'ipapi.co' ? createHash('sha256').update(process.env.SECURITY_GEOIP_API_KEY || '').digest('hex') : 'public'}`;
function retryTime(response: Response, fallbackMs: number): number {
  const value = response.headers.get('retry-after');
  if (!value) return Date.now() + fallbackMs;
  const seconds = Number(value);
  const until = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(value);
  return Number.isFinite(until) ? Math.max(Date.now() + 60000, until) : Date.now() + fallbackMs;
}
function backoff(source: GeoSource, status: string, until: number) {
  if (providerBackoff.size >= 32) providerBackoff.delete(providerBackoff.keys().next().value!);
  providerBackoff.set(sourceKey(source), { status, until });
}
async function lookupSource(ip: string, source: GeoSource): Promise<SecurityGeo> {
  const checkedAt = new Date().toISOString();
  const blocked = providerBackoff.get(sourceKey(source));
  if (blocked && blocked.until > Date.now()) return { status: blocked.status, source, checkedAt, retryAt: new Date(blocked.until).toISOString() };
  try {
    const url = source === 'ipapi.co' ? new URL(`https://ipapi.co/${encodeURIComponent(ip)}/json/`) : new URL(`https://ipwho.is/${encodeURIComponent(ip)}`);
    if (source === 'ipapi.co' && process.env.SECURITY_GEOIP_API_KEY) url.searchParams.set('key', process.env.SECURITY_GEOIP_API_KEY);
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000), headers: { Accept: 'application/json' } });
    let status: string | undefined;
    if (response.status === 429) status = 'rate_limited';
    else if (response.status === 401 || response.status === 403) status = 'provider_rejected';
    else if (!response.ok) throw new Error('Provider unavailable');
    const data = status ? null : await response.json();
    if (data && (data.error || data.success === false)) {
      const reason = String(data.reason || data.message || '');
      status = /rate|quota|limit/i.test(reason) ? 'rate_limited' : /auth|key|permission/i.test(reason) ? 'provider_rejected' : 'unavailable';
    }
    if (status) {
      const until = retryTime(response, status === 'rate_limited' ? source === 'ipwho.is' ? 86400000 : 900000 : 60000);
      backoff(source, status, until);
      return { status, source, checkedAt, retryAt: new Date(until).toISOString() };
    }
    const latitude = data?.latitude, longitude = data?.longitude;
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid location');
    providerBackoff.delete(sourceKey(source));
    return {
      status: 'approximate', source, checkedAt, latitude, longitude, city: clean(data.city), region: clean(data.region),
      country: clean(source === 'ipapi.co' ? data.country_name : data.country), countryCode: clean(data.country_code, 3), postal: clean(data.postal, 20),
      timezone: clean(source === 'ipapi.co' ? data.timezone : data.timezone?.id, 80),
      organization: clean(source === 'ipapi.co' ? data.org : data.connection?.org, 160),
      asn: source === 'ipapi.co' ? clean(data.asn, 40) : Number.isSafeInteger(data.connection?.asn) && data.connection.asn > 0 ? `AS${data.connection.asn}` : '',
      ...(source === 'ipwho.is' ? { isp: clean(data.connection?.isp, 160) } : {}),
    };
  } catch {
    const until = Date.now() + 60000;
    backoff(source, 'unavailable', until);
    return { status: 'unavailable', source, checkedAt, retryAt: new Date(until).toISOString() };
  }
}
export async function lookupIp(value: unknown): Promise<SecurityGeo> {
  const ip = publicIp(value), checkedAt = new Date().toISOString();
  if (!ip) return { status: 'no_public_ip', checkedAt };
  if (process.env.ADMIN_IP_LOOKUP_ENABLED === 'false') return { status: 'disabled', checkedAt };
  const fallback = process.env.ADMIN_IP_LOOKUP_FALLBACK !== 'false';
  // Key changes immediately invalidate old failure/cache state; no API key is stored in the map.
  const key = `${ip}:${sourceKey('ipapi.co')}:${fallback}`;
  const hit = geoCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pendingGeo.has(key)) return pendingGeo.get(key)!;
  if (pendingGeo.size >= 6) return { status: 'busy', checkedAt };
  const task = (async (): Promise<SecurityGeo> => {
    const primary = await lookupSource(ip, 'ipapi.co');
    if (primary.status === 'approximate') return primary;
    const backup = fallback ? await lookupSource(ip, 'ipwho.is') : undefined;
    if (backup?.status === 'approximate') return backup;
    const retries = [primary.retryAt, backup?.retryAt].filter((value): value is string => Boolean(value)).sort();
    // Keep an explicitly labeled last-known location for the same IP for up to
    // seven days. Never substitute another user's IP or the admin's own location.
    if (hit?.value.status === 'approximate' && Date.now() - Date.parse(hit.value.checkedAt || '') < 7 * 86400000) return { ...hit.value, stale: true, retryAt: retries[0] };
    const failures = [primary, ...(backup ? [backup] : [])];
    const failure = failures.find(result => result.status === 'rate_limited') || failures.find(result => result.status === 'provider_rejected') || primary;
    return { ...failure, retryAt: retries[0] };
  })().then(result => {
    cache(geoCache, key, result, result.status === 'approximate' && !result.stale ? 86400000 : 60000);
    return result;
  }).finally(() => pendingGeo.delete(key));
  pendingGeo.set(key, task);
  return task;
}
// Load only the address family needed. Concurrent lookups share the same read.
const localReaders = new Map<number, Promise<Reader<Record<string, unknown>>>>();
async function reportGeo(value: unknown, saved?: SecurityGeo): Promise<SecurityGeo> {
  const result = await lookupIp(value);
  const ip = publicIp(value);
  if (!ip || result.status === 'approximate' || result.status === 'disabled' || saved?.status === 'approximate') return result;
  const family = isIP(ip);
  try {
    let reader = localReaders.get(family);
    if (!reader) {
      const filename = family === 4 ? 'dbip-city-ipv4.mmdb' : 'dbip-city-ipv6.mmdb';
      const file = path.join(process.cwd(), 'node_modules', '@ip-location-db', 'dbip-city-mmdb', filename);
      reader = readFile(file).then(data => new Reader<Record<string, unknown>>(data)).catch(error => {
        localReaders.delete(family);
        throw error;
      });
      localReaders.set(family, reader);
    }
    const db = await reader;
    const row = db.get(ip);
    const lat = row?.latitude, lon = row?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return result;
    const code = clean(row?.country_code, 2);
    return { status: 'approximate', source: 'DB-IP Lite', checkedAt: new Date().toISOString(),
      databaseDate: db.metadata.buildEpoch.toISOString().slice(0, 10), latitude: lat, longitude: lon,
      countryCode: code, country: /^[A-Z]{2}$/.test(code) ? new Intl.DisplayNames(['en'], { type: 'region' }).of(code) : undefined,
      city: clean(row?.city), region: clean(row?.state1), postal: clean(row?.postcode), timezone: clean(row?.timezone) };
  } catch { return result; }
}

const normal = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const plain = (value: unknown) => clean(typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : '', 300);
const hardwareCode = (value: string) => value.length <= 32 && /[a-z]/i.test(value) && /\d/.test(value) && (/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/DS)?$/i.test(value) || /^(?:iPhone|iPad|iPod)\d+,\d+$/i.test(value));
export function searchableModel(value: unknown) {
  const model = clean(value);
  if (!model || model.length > 80 || !/^[a-z0-9 ,().+\/-]+$/i.test(model)) return null;
  const productName = /^(?:apple )?(?:iphone|ipad|ipod)\b|^(?:samsung|galaxy|google pixel|pixel|oneplus|xiaomi|redmi|poco|oppo|vivo|realme|nokia|motorola|moto|sony xperia|xperia|huawei|honor|asus|zenfone|nothing phone)\b/i.test(model);
  // Android Build.MODEL is manufacturer-defined; do not reject a valid hardware
  // code simply because its vendor prefix is absent from a short brand list.
  return hardwareCode(model) || productName && /\d/.test(model) ? model : null;
}
function safeUrl(value: unknown, hosts: string[]) {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
type AndroidModel = { name: string; brand: string };
const deviceCatalogUrl = 'https://storage.googleapis.com/play_public/supported_devices.csv';
const deviceCatalogSource = 'https://storage.googleapis.com/play_public/supported_devices.html';
let androidModels: { data: Map<string, AndroidModel | null>; checkedAt: number } | undefined;
let androidModelsPending: Promise<Map<string, AndroidModel | null>> | undefined;
let androidModelsRetryAt = 0;

export function parseAndroidModels(csv: string): Map<string, AndroidModel | null> {
  const models = new Map<string, AndroidModel | null>();
  let field = '', row: string[] = [], quoted = false, columns: string[] | undefined;
  const accept = () => {
    if (!columns) columns = row.map(value => value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z]/g, ''));
    else {
      const code = clean(row[columns.indexOf('model')], 80).toLowerCase();
      const marketing = clean(row[columns.indexOf('marketingname')], 160);
      const brand = clean(row[columns.indexOf('retailbranding')], 80);
      if (code && marketing && brand) {
        const name = marketing.toLowerCase().startsWith(`${brand.toLowerCase()} `) ? marketing : `${brand} ${marketing}`;
        const previous = models.get(code);
        if (previous === undefined) models.set(code, { name, brand });
        else if (previous && previous.name.toLowerCase() !== name.toLowerCase()) models.set(code, null);
      }
    }
    row = [];
  };
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && csv[index + 1] === '\n') index++;
      row.push(field); field = ''; accept();
    } else field += char;
  }
  if (field || row.length) { row.push(field); accept(); }
  if (quoted || !columns?.includes('model') || !columns.includes('marketingname') || !columns.includes('retailbranding')) throw new Error('Invalid device catalog');
  return models;
}
async function resolveAndroidModel(model: string): Promise<AndroidModel | null | undefined> {
  if (!hardwareCode(model) || /^(iphone|ipad|ipod)\d+,\d+$/i.test(model)) return undefined;
  const now = Date.now();
  if (androidModels && now - androidModels.checkedAt < 86400000) return androidModels.data.get(model.toLowerCase());
  if (androidModelsRetryAt > now) return undefined;
  if (!androidModelsPending) {
    androidModelsPending = (async () => {
      const response = await fetch(deviceCatalogUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 16 * 1024 * 1024) throw new Error('Device catalog unavailable');
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 16 * 1024 * 1024) { await reader.cancel(); throw new Error('Device catalog too large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = Buffer.concat(chunks);
      const encoding = bytes[0] === 255 && bytes[1] === 254 || bytes[1] === 0 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
      const data = parseAndroidModels(new TextDecoder(encoding).decode(bytes));
      if (!data.size) throw new Error('Empty device catalog');
      androidModels = { data, checkedAt: Date.now() };
      return data;
    })().catch(() => { androidModelsRetryAt = Date.now() + 300000; return new Map<string, AndroidModel | null>(); }).finally(() => { androidModelsPending = undefined; });
  }
  return (await androidModelsPending).get(model.toLowerCase());
}
type CatalogEntity = {
  id?: string;
  labels?: Record<string, { value?: string }>;
  aliases?: Record<string, { value?: string }[]>;
  claims?: { P18?: { rank?: string; mainsnak?: { snaktype?: string; datavalue?: { value?: unknown } } }[] };
};
type CommonsPage = { imageinfo?: { url?: string; thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] };
const modelKey = (value: string) => normal(value.replace(/\+/g, ' plus '))
  .replace(/^(apple|google|samsung) /, '')
  .replace(/^motorola (?:moto )?(?=g\d)/, 'moto ');
const photoSources = ['apple.com', 'samsung.com', 'google.com', 'oneplus.com', 'mi.com', 'oppo.com', 'vivo.com', 'realme.com', 'motorola.com', 'motorola.in', 'sony.com', 'huawei.com', 'honor.com', 'asus.com', 'nothing.tech', 'hmd.com', 'gsmarena.com', 'devicespecifications.com'];
function sourcePhotoUrl(value: unknown, hosts: string[]) {
  if (typeof value !== 'string' || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : undefined;
  } catch { return undefined; }
}
function publicSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') || isIP(host) || host.startsWith('[') || /\.(local|localhost|internal|test|invalid|example)$/.test(host)) return undefined;
    return url.href;
  } catch { return undefined; }
}
export function matchesDeviceImageTitle(title: unknown, model: string): boolean {
  const text = plain(title);
  if (/\b(case|cover|protector|wallpaper|repair|replacement|versus|vs|comparison|concept|rumou?r|series|family|battery|charger|lcd|digitizer|teardown|motherboard|firmware)\b/i.test(text)) return false;
  // Hardware codes often appear after the product name in shopping/catalog
  // titles. Accept a complete code token as a search reference, never as proof
  // that the returned product name uniquely identifies the user's device.
  if (hardwareCode(model)) return ` ${normal(text)} `.includes(` ${normal(model)} `);
  const variants = normal(text.replace(/\+/g, ' plus ')).match(/\b(pro|max|plus|ultra|mini|lite|fe|4g|5g)\b/g) || [];
  const modelWords = modelKey(model).split(' ');
  if (variants.some(variant => !modelWords.includes(variant))) return false;
  // Require the complete product heading, not a substring such as iPhone 15
  // inside iPhone 15 Pro. Search metadata is a reference, not hardware proof.
  const heading = text.split(/\s[|–—]\s|\s-\s/)[0].replace(/\s+(?:pictures|photos|images|specifications|specs|review)$/i, '');
  const titleKey = modelKey(heading), expected = modelKey(model);
  if (titleKey === expected) return true;
  // Shops append finish/capacity to the same model. Accept only recognizable
  // retail metadata, never arbitrary words or another phone/model suffix.
  if (!titleKey.startsWith(`${expected} `)) return false;
  const retailDetails = titleKey.slice(expected.length).trim()
    .replace(/\b\d+\s*(?:gb|tb)\b/g, '')
    .replace(/\b(?:ram|rom|storage|memory|brilliant|viva|magenta|blue|green|red|black|white|silver|gold|grey|gray|pink|purple|lavender|dahlia|moss|midnight|graphite|titanium|smartphone|phone)\b/g, '')
    .replace(/\s+/g, '');
  return retailDetails.length === 0;
}
let serperCooldown: { key: string; until: number } | undefined;
async function serperPhoto(model: string, mapped?: AndroidModel | null): Promise<DevicePhoto | undefined> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return undefined;
  const key = createHash('sha256').update(apiKey).digest('hex');
  if (serperCooldown?.key === key && serperCooldown.until > Date.now()) return undefined;
  const name = mapped?.name || model;
  try {
    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ q: `"${name}" device product photo`, num: 10, autocorrect: false }),
    });
    if (!response.ok) {
      serperCooldown = { key, until: retryTime(response, response.status === 429 ? 900000 : 60000) };
      return undefined;
    }
    const data = await response.json();
    if (!Array.isArray(data?.images)) throw new Error('Invalid image results');
    // Prefer established manufacturer/catalog sources, then retain Google's
    // order for other public sources with a relevant model title.
    const images = data.images.slice(0, 10).filter((item: unknown) => item && typeof item === 'object');
    images.sort((a: { link?: unknown }, b: { link?: unknown }) => Number(Boolean(sourcePhotoUrl(b.link, photoSources))) - Number(Boolean(sourcePhotoUrl(a.link, photoSources))));
    for (const item of images) {
      if (!matchesDeviceImageTitle(item.title, name) && !(hardwareCode(model) && matchesDeviceImageTitle(item.title, model))) continue;
      const sourceUrl = publicSourceUrl(item.link);
      const imageUrl = sourcePhotoUrl(item.imageUrl, [...photoSources, 'cdn-apple.com', 'samsungmobilepress.com', 'samsungmobile.com', 'samsungimg.com', 'moto.com', 'mi-img.com', 'gstatic.com', 'googleusercontent.com']) || sourcePhotoUrl(item.thumbnailUrl, ['gstatic.com']);
      if (!sourceUrl || !imageUrl) continue;
      return { status: 'found', model, matchedModel: name, provider: 'serper', sourceLabel: new URL(sourceUrl).hostname,
        searchTitle: plain(item.title), sharedModelCode: mapped === null,
        ...(mapped ? { resolvedModel: name, modelMappingUrl: deviceCatalogSource } : {}),
        imageUrl, thumbnailUrl: sourcePhotoUrl(item.thumbnailUrl, ['gstatic.com']), sourceUrl, modelSourceUrl: sourceUrl };
    }
  } catch { serperCooldown = { key, until: Date.now() + 60000 }; }
  return undefined;
}
async function catalog<T>(host: 'www.wikidata.org' | 'commons.wikimedia.org', params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  const res = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'HappiNotesAdminDeviceCatalog/1.0 (https://happinotes.online)', Accept: 'application/json' } });
  if (!res.ok) throw new Error('Catalog unavailable');
  const data = await res.json();
  if (!data || data.error) throw new Error('Catalog unavailable');
  return data as T;
}
async function findPhoto(model: string): Promise<DevicePhoto> {
  const mapped = await resolveAndroidModel(model);
  const searchedPhoto = await serperPhoto(model, mapped);
  if (searchedPhoto) return searchedPhoto;
  if (mapped === null) return { status: 'not_found', model, reason: 'ambiguous_match', modelMappingUrl: deviceCatalogSource };
  const identity = { model, ...(mapped ? { resolvedModel: mapped.name, modelMappingUrl: deviceCatalogSource } : {}) };
  const query = modelKey(mapped?.name || model);
  const search = await catalog<{ search?: { id: string }[] }>('www.wikidata.org', { action: 'wbsearchentities', search: mapped?.name || model, language: 'en', type: 'item', limit: '5' });
  const ids = [...new Set((search.search || []).map(item => item.id).filter(id => /^Q[1-9]\d*$/.test(id)))].slice(0, 5);
  if (!ids.length) return { status: 'not_found', ...identity, reason: 'no_catalog_match' };
  const data = await catalog<{ entities?: Record<string, CatalogEntity> }>('www.wikidata.org', { action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|claims', languages: 'en|mul' });
  const matches = ids.map(id => ({ id, entity: data.entities?.[id] })).filter(({ entity }) => {
    if (!entity) return false;
    const labels = Object.values(entity.labels || {}).map(label => plain(label.value)).filter(Boolean);
    // An article/family containing several variants is not an exact model.
    if (!labels.length || labels.some(label => /\b(series|family)\b|\s(?:and|&|\/)\s/i.test(label))) return false;
    if (labels.some(label => modelKey(label) === query)) return true;
    // Hardware codes must be an explicit catalog alias, never a search snippet,
    // a truncated model number, or a nearby device in the same product family.
    return hardwareCode(model) && Object.values(entity.aliases || {}).flat().some(alias => modelKey(plain(alias.value)) === query);
  });
  if (matches.length !== 1) return { status: 'not_found', ...identity, reason: matches.length ? 'ambiguous_match' : 'no_catalog_match' };
  const { id, entity } = matches[0];
  const images = (entity!.claims?.P18 || []).filter(claim => claim.rank !== 'deprecated' && claim.mainsnak?.snaktype === 'value' && typeof claim.mainsnak.datavalue?.value === 'string');
  const imageClaim = images.find(claim => claim.rank === 'preferred') || images[0];
  const filename = imageClaim?.mainsnak?.datavalue?.value;
  if (typeof filename !== 'string' || filename.length > 240 || !/\.(jpe?g|png|webp)$/i.test(filename)) return { status: 'not_found', ...identity, matchedModel: plain(entity!.labels?.en?.value || entity!.labels?.mul?.value), reason: 'no_catalog_photo' };
  const result = await catalog<{ query?: { pages?: CommonsPage[] } }>('commons.wikimedia.org', { action: 'query', titles: `File:${filename}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '360', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl' });
  const info = result.query?.pages?.[0]?.imageinfo?.[0];
  const imageUrl = safeUrl(info?.thumburl, ['upload.wikimedia.org', 'thumb.wikimedia.org']) || safeUrl(info?.url, ['upload.wikimedia.org', 'thumb.wikimedia.org']);
  const sourceUrl = safeUrl(info?.descriptionurl, ['commons.wikimedia.org']);
  const rawLicenseUrl = info?.extmetadata?.LicenseUrl?.value;
  const licenseUrl = safeUrl(typeof rawLicenseUrl === 'string' ? rawLicenseUrl.replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://') : undefined, ['creativecommons.org', 'commons.wikimedia.org']);
  const author = plain(info?.extmetadata?.Artist?.value), license = plain(info?.extmetadata?.LicenseShortName?.value);
  if (!imageUrl || !sourceUrl || !author || !/^(?:CC BY(?:-SA)?(?: \d(?:\.\d)?)?|CC0(?: 1\.0)?|Public domain)$/i.test(license) || (!licenseUrl && !/^Public domain$/i.test(license))) return { status: 'not_found', ...identity, reason: 'image_metadata_unavailable' };
  return { status: 'found', ...identity, matchedModel: plain(entity!.labels?.en?.value || entity!.labels?.mul?.value), modelSourceUrl: `https://www.wikidata.org/wiki/${id}`, imageUrl, sourceUrl, licenseUrl, author, license };
}
export type DeviceReferenceStore = {
  read: () => Promise<{ photo: DevicePhoto; checkedAt: string; expiresAt: string } | null>;
  write: (photo: DevicePhoto) => Promise<boolean>;
};
export async function lookupDevice(value: unknown, retry = false, store?: DeviceReferenceStore): Promise<DevicePhoto> {
  const model = searchableModel(value);
  if (!model) return { status: 'not_found', model: clean(value), reason: clean(value) ? 'model_unsupported' : 'model_missing' };
  const providerKey = createHash('sha256').update(process.env.SERPER_API_KEY?.trim() || '').digest('hex');
  const key = `reference-v9:${store ? 'persistent' : 'memory'}:${providerKey}:${normal(model.replace(/\+/g, ' plus '))}`, hit = photoCache.get(key);
  if (hit && hit.expires > Date.now() && !(retry && Date.now() - (hit.checkedAt || 0) >= 60000)) {
    if (store && hit.value.cacheStorage !== 'mongodb') {
      try { if (await store.write(hit.value)) hit.value.cacheStorage = 'mongodb'; } catch { /* Retry database persistence on a later authorized view. */ }
    }
    return { ...hit.value, model };
  }
  if (pendingPhotos.has(key)) return pendingPhotos.get(key)!;
  if (pendingPhotos.size >= 6) return { status: 'unavailable', model, reason: 'busy' };
  const task = (async () => {
    if (store) {
      try {
        const saved = await store.read();
        const checkedAt = Date.parse(saved?.checkedAt || ''), expires = Date.parse(saved?.expiresAt || '');
        if (saved && saved.photo.model.toLowerCase() === model.toLowerCase() && Number.isFinite(checkedAt) && expires > Date.now() && !(retry && Date.now() - checkedAt >= 60000)) {
          const result: DevicePhoto = { ...saved.photo, model, cacheStorage: 'mongodb', fetchedAt: saved.checkedAt };
          cache(photoCache, key, result, expires - Date.now());
          photoCache.get(key)!.checkedAt = checkedAt;
          return result;
        }
      } catch { /* Provider lookup remains usable during backend rollout/outages. */ }
    }
    const result = await findPhoto(model).catch((): DevicePhoto => ({ status: 'unavailable', model, reason: 'catalog_unavailable' }));
    if (store) {
      result.fetchedAt = new Date().toISOString();
      try { result.cacheStorage = await store.write(result) ? 'mongodb' : 'memory'; }
      catch { result.cacheStorage = 'memory'; }
    }
    cache(photoCache, key, result, result.status === 'found' ? 604800000 : result.status === 'not_found' ? 3600000 : 60000);
    photoCache.get(key)!.checkedAt = Date.now();
    return result;
  })().finally(() => pendingPhotos.delete(key));
  pendingPhotos.set(key, task);
  return task;
}
const requestLimits = new Map<string, { count: number; until: number }>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' } });
const defaultReportBackend = 'https://happinotes-production-6b44.up.railway.app';

function reportApiBase(configured: string) {
  const serverOrigin = process.env.AUTH_BACKEND_ORIGIN?.trim();
  const railway = process.env.NEXT_PUBLIC_RAILWAY_API_BASE_URL?.trim() || defaultReportBackend;
  let value = configured.trim();
  if (process.env.NODE_ENV === 'production' && serverOrigin) {
    value = serverOrigin;
  } else {
    // Hosting dashboards can preserve dotenv references as literal strings.
    if (['$NEXT_PUBLIC_LOCAL_API_BASE_URL', '${NEXT_PUBLIC_LOCAL_API_BASE_URL}'].includes(value)) {
      value = process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL?.trim() || '';
      if (!value) return undefined;
    } else if (['$NEXT_PUBLIC_RAILWAY_API_BASE_URL', '${NEXT_PUBLIC_RAILWAY_API_BASE_URL}'].includes(value)) {
      value = railway;
    }
    // Relative paths belong to the browser. Never derive the upstream from request headers.
    if (!value || (value.startsWith('/') && !value.startsWith('//'))) value = serverOrigin || railway;
  }
  try {
    const url = new URL(value || '');
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) return url.href.replace(/\/+$/, '');
  } catch { /* A configuration error is reported without including the target. */ }
}

export async function handleSecurityLookup(request: Request, apiBase: string): Promise<Response> {
  const token = request.headers.get('authorization');
  if (!token || !/^Bearer \S+$/.test(token) || token.length > 8192) return json({ message: 'Admin sign-in is required.' }, 401);
  const params = new URL(request.url).searchParams;
  const id = params.get('userId') || '';
  if (!/^[a-f\d]{24}$/i.test(id)) return json({ message: 'Invalid user ID.' }, 400);
  const deviceId = params.get('deviceId') || '';
  if (deviceId && !/^[a-f\d]{24}$/i.test(deviceId)) return json({ message: 'Invalid device ID.' }, 400);
  const limitKey = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const previous = requestLimits.get(limitKey);
  const limit = previous && previous.until > now ? previous : { count: 0, until: now + 60000 };
  if (limit.count >= 30) return json({ message: 'Too many lookups. Wait one minute before retrying.' }, 429);
  limit.count += 1;
  if (requestLimits.size >= 1000 && !requestLimits.has(limitKey)) requestLimits.delete(requestLimits.keys().next().value!);
  requestLimits.set(limitKey, limit);
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page') || '1', 10) || 1));
  // Reuse the existing protected listing endpoint to authorize every request and
  // obtain the observed IP/model. Never trust caller-supplied IPs or model names.
  const base = reportApiBase(apiBase);
  if (!base) return json({ message: 'The user report service is unavailable.' }, 503);
  const query = new URLSearchParams({ page: String(page), query: clean(params.get('query')), lookupUserId: id });
  if (deviceId) query.set('deviceId', deviceId);
  const url = `${base}/admin/user-security?${query}`;
  let users: SecurityUser[] | undefined;
  for (const timeout of [5000, 10000]) {
    try {
      const response = await fetch(url, { headers: { Authorization: token, Accept: 'application/json' }, cache: 'no-store', redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeout)]) });
      if (response.status === 401 || response.status === 403) return json({ message: 'Admin access expired or denied. Sign in again.' }, response.status);
      if (response.status === 429) return json({ message: 'Too many requests. Please retry shortly.' }, 429);
      if ([502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) return json({ message: 'Could not load this account report. Refresh the user list and retry.' }, 502);
      const data = await response.json();
      if (!Array.isArray(data?.users)) return json({ message: 'The user report was incomplete. Refresh the user list and retry.' }, 502);
      users = data.users;
      break;
    } catch {
      if (request.signal.aborted) break;
    }
  }
  if (!users) return json({ message: 'The account report is temporarily unavailable. Please retry.' }, 503);
  const user = users.find(item => String(item.id) === id);
  if (!user) return json({ message: 'The user list changed. Close these details and refresh the list.' }, 404);
  const network = deviceId ? user.devices?.find(item => String(item._id) === deviceId) : user.legacyNetwork || user.network;
  if (deviceId && !network) return json({ message: 'This device does not belong to the selected account. Refresh the list.' }, 404);
  const actualDeviceId = deviceId || user.devices?.find(item => item._id === network?._id)?._id;
  const cacheUrl = `${base}/admin/user-security/${id}/device-reference${actualDeviceId ? `?deviceId=${encodeURIComponent(actualDeviceId)}` : ''}`;
  const store: DeviceReferenceStore = {
    read: async () => {
      const result = await fetch(cacheUrl, { headers: { Authorization: token, Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000) });
      if (!result.ok) return null;
      const saved = await result.json();
      return saved?.photo ? saved : null;
    },
    write: async photo => {
      const result = await fetch(cacheUrl, { method: 'PUT', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify({ photo }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000) });
      return result.ok;
    },
  };
  const [geo, device] = await Promise.all([reportGeo(network?.publicIp, network?.geo), lookupDevice(network?.deviceModel, params.get('retryImage') === '1', store).catch((): DevicePhoto => ({ status: 'unavailable', model: clean(network?.deviceModel), reason: 'catalog_unavailable' }))]);
  return json({ userId: id, ...(actualDeviceId ? { deviceId: actualDeviceId } : {}), publicIp: network?.publicIp || '', geo, device });
}
