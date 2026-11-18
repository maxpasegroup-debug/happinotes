/** Only the public Firebase handoff page is proxied; other APIs remain private. */
const publicOrigin = 'https://happinotes.online';
const sessionPattern = /^[a-f0-9]{64}$/;
const bodyLimit = 16 * 1024;

function failure(status: number, page: boolean) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
  if (!page) return Response.json({ message: 'Sign-in could not finish. Please return to HappiNotes and try again.' }, { status, headers });
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HappiNotes</title><h1>Start sign-in again</h1><p>Return to HappiNotes and try Google sign-in again.</p></html>', {
    status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
  });
}

async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > bodyLimit) throw new Error('body too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body missing');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) { await reader.cancel(); throw new Error('body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
}

export async function proxyGoogleBrowser(request: Request, action: string, upstreamFetch: typeof fetch = fetch) {
  const page = action === 'page';
  if (!(page && request.method === 'GET') && !(action === 'complete' && request.method === 'POST')) return failure(404, false);
  let sessionId: string;
  let body: string | undefined;
  if (page) {
    sessionId = new URL(request.url).searchParams.get('session') || '';
  } else {
    if (request.headers.get('origin') !== publicOrigin) return failure(403, false);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure(415, false);
    try {
      const data = await readBody(request);
      sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
      if (data.cancelled === true) body = JSON.stringify({ sessionId, cancelled: true });
      else {
        if (typeof data.firebaseIdToken !== 'string' || data.firebaseIdToken.length < 100 || data.firebaseIdToken.length > 12000) return failure(400, false);
        body = JSON.stringify({ sessionId, firebaseIdToken: data.firebaseIdToken });
      }
    } catch { return failure(400, false); }
  }
  if (!sessionPattern.test(sessionId)) return failure(400, page);
  try {
    // Browser-facing API settings can be relative proxy paths. This server-to-server
    // route needs its own absolute origin and must not inherit those client values.
    const backend = new URL(process.env.AUTH_BACKEND_ORIGIN || 'https://happinotes-production-6b44.up.railway.app');
    if (backend.protocol !== 'https:' || backend.username || backend.password || backend.origin === publicOrigin) return failure(503, page);
    const url = new URL(`/auth/google/browser/${action}`, backend.origin);
    if (page) url.searchParams.set('session', sessionId);
    const headers = new Headers();
    const cookieName = `__Host-happiGoogle-${sessionId.slice(0, 12)}`;
    const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
    if (cookie && sessionPattern.test(cookie.slice(cookieName.length + 1))) headers.set('cookie', cookie);
    if (!page) { headers.set('origin', publicOrigin); headers.set('content-type', 'application/json'); }
    const response = await upstreamFetch(url, {
      method: request.method, headers, body, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) return failure([400, 401, 403, 410, 429].includes(response.status) ? response.status : 502, page);
    const outputHeaders = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    for (const name of ['content-security-policy', 'cross-origin-opener-policy']) {
      const value = response.headers.get(name);
      if (value) outputHeaders.set(name, value);
    }
    // Never forward unrelated website/admin cookies or widen the cookie domain.
    for (const value of response.headers.getSetCookie()) {
      if (value.startsWith(`${cookieName}=`) && !/;\s*domain=/i.test(value)) outputHeaders.append('set-cookie', value);
    }
    if (page) {
      if (!response.headers.get('content-type')?.includes('text/html')) return failure(502, true);
      outputHeaders.set('content-type', 'text/html; charset=utf-8');
      return new Response(response.body, { headers: outputHeaders });
    }
    return Response.json({ success: true }, { headers: outputHeaders });
  } catch { return failure(502, page); }
}
