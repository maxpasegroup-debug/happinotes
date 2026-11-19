type Listing = { packageName: string; title: string; summary: string; url: string };
const recent = new Map<string, { expires: number; items: Listing[] }>();
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function packageFromLink(link: unknown) {
  if (typeof link !== 'string') return;
  try {
    const url = new URL(link);
    const id = url.searchParams.get('id') || '';
    if (url.origin === 'https://play.google.com' && url.pathname === '/store/apps/details' &&
      /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i.test(id)) return id;
  } catch { /* Ignore links outside the store. */ }
}

export async function searchPlayStore(request: Request, apiBase: string, key: string | undefined, fetcher = fetch) {
  const token = request.headers.get('authorization');
  if (!token || !/^Bearer \S+$/.test(token) || token.length > 8192) return reply({ message: 'Sign in to search.' }, 401);
  const input = new URL(request.url).searchParams.get('q')?.trim() || '';
  const exact = packageFromLink(input);
  const query = exact || input;
  if (!query || query.length > 160 || (!exact && /:\/\//.test(input))) return reply({ message: 'Enter an app name, keyword, package name or Google Play listing link.' }, 400);
  try {
    // This lightweight endpoint checks admin access and applies the existing request limit.
    const access = await fetcher(apiBase.replace(/\/+$/, '') + '/admin/google-play/sync-status', {
      headers: { Authorization: token }, signal: AbortSignal.timeout(6000), cache: 'no-store', redirect: 'error',
    });
    if ([401, 403].includes(access.status)) return reply({ message: 'Admin access is required.' }, access.status);
    if (access.status === 429) return reply({ message: 'Too many searches. Try again in a minute.' }, 429);
    if (!access.ok || typeof (await access.json()).configured !== 'boolean') return reply({ message: 'Unable to verify access. Try again.' }, 503);
    const cacheKey = JSON.stringify([exact || '', query.toLowerCase()]);
    const cached = recent.get(cacheKey);
    if (cached && cached.expires > Date.now()) return reply({ items: cached.items });
    if (!key?.trim()) return reply({ message: 'Store search is unavailable. Contact your administrator.' }, 503);
    const response = await fetcher('https://google.serper.dev/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': key.trim() },
      body: JSON.stringify({ q: 'site:play.google.com/store/apps/details ' + query, num: 10 }),
      signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
    });
    if (!response.ok) return reply({ message: 'Store search is temporarily unavailable. Try again later.' }, response.status === 429 ? 429 : 502);
    const data = await response.json();
    if (!Array.isArray(data.organic)) return reply({ message: 'Store search returned an unexpected response. Try again.' }, 502);
    const matches = new Map<string, Listing>();
    for (const row of data.organic) {
      const id = packageFromLink(row?.link);
      if (!id || (exact && id !== exact) || matches.has(id) || typeof row.title !== 'string') continue;
      matches.set(id, { packageName: id, title: row.title, summary: typeof row.snippet === 'string' ? row.snippet : '',
        url: 'https://play.google.com/store/apps/details?id=' + encodeURIComponent(id) });
    }
    const items = [...matches.values()];
    if (recent.size >= 100) recent.delete(recent.keys().next().value!);
    recent.set(cacheKey, { expires: Date.now() + 300_000, items });
    return reply({ items });
  } catch {
    return reply({ message: 'Unable to complete the search. Please try again.' }, 503);
  }
}
