import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { browserConfiguration, completeBrowserSession, openBrowserSession, pollBrowserSession, randomSecret, SESSION_SECONDS, startBrowserSession, validSecret } from '../services/googleBrowserSession';
import { googleBrowserPage } from '../services/googleBrowserPage';
import { AppError } from '../utils/errors';

const router = Router();
const limiter = (max: number, windowMs = 60_000) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many sign-in requests. Please try again later.' } });
const cookieName = (id: string) => `__Host-happiGoogle-${id.slice(0, 12)}`;
function browserCookie(req: Request, id: unknown) {
  if (!validSecret(id)) return undefined;
  const prefix = `${cookieName(id)}=`;
  return req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(prefix))?.slice(prefix.length);
}
router.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer' }); next(); });
router.post('/start', limiter(5, 15 * 60_000), async (req, res, next) => {
  try { res.json(await startBrowserSession(req.body?.challenge)); } catch (e) { next(e); }
});
router.get('/page', limiter(20), async (req, res) => {
  try {
    const id = req.query.session;
    const config = await openBrowserSession(id, browserCookie(req, id));
    const nonce = randomSecret();
    res.cookie(cookieName(id as string), config.cookie, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS * 1000 });
    res.set({
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://www.gstatic.com https://apis.google.com; style-src 'nonce-${nonce}'; connect-src 'self' https://*.googleapis.com https://${config.firebase.authDomain}; frame-src https://${config.firebase.authDomain} https://accounts.google.com; img-src data: https://*.googleusercontent.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
    res.type('html').send(googleBrowserPage(id as string, config.firebase, nonce));
  } catch {
    res.status(410).type('html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HappiNotes</title><h1>Start sign-in again</h1><p>Close this browser and return to HappiNotes to try again.</p></html>');
  }
});
router.post('/complete', limiter(20), async (req, res, next) => {
  try {
    if (req.get('origin') !== browserConfiguration().origin) throw new AppError('Invalid sign-in request.', 403);
    const id = req.body?.sessionId;
    await completeBrowserSession(id, browserCookie(req, id), req.body?.firebaseIdToken, req.body?.cancelled === true);
    res.clearCookie(cookieName(id), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/poll', limiter(180), async (req, res, next) => {
  try { res.json(await pollBrowserSession(req.body?.sessionId, req.body?.verifier)); } catch (e) { next(e); }
});
router.post('/cancel', limiter(20), async (req, res, next) => {
  try { res.json(await pollBrowserSession(req.body?.sessionId, req.body?.verifier, true)); } catch (e) { next(e); }
});
export default router;
