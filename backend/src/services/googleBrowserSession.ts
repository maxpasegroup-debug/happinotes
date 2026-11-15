import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { GoogleBrowserSession } from '../models/GoogleBrowserSession';
import { env } from '../config/env';
import { getFirebaseAuth } from './firebaseAdmin';
import { verifyFirebaseGoogleIdentity } from './firebaseGoogleIdentity';
import { AppError, BadRequestError } from '../utils/errors';

export const SESSION_SECONDS = 300;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomSecret = () => randomBytes(32).toString('hex');
export function validSecret(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
const expired = () => new AppError('Google sign-in expired. Please try again.', 410);
const active = (id: string) => ({ sessionHash: digest(id), expiresAt: { $gt: new Date() } });

export function browserConfiguration() {
  try {
    const parsed = JSON.parse(process.env.FIREBASE_WEB_CONFIG_JSON || '{}');
    const url = new URL(process.env.GOOGLE_SIGN_IN_BROWSER_ORIGIN || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new Error();
    for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) if (typeof parsed[key] !== 'string' || !parsed[key].trim()) throw new Error();
    const auth = getFirebaseAuth();
    if (!auth || auth.app.options.projectId !== parsed.projectId) throw new Error();
    if (!/^[a-z0-9.-]+$/.test(parsed.authDomain)) throw new Error();
    // Return ONLY Firebase's public Web config, never any server credentials.
    return { origin: url.origin, firebase: { apiKey: parsed.apiKey, authDomain: parsed.authDomain, projectId: parsed.projectId, appId: parsed.appId } };
  } catch { throw new AppError('Google browser sign-in is not configured yet. Please use email sign-in.', 503); }
}

function encryptionKey() { return createHash('sha256').update('happinotes-google-browser-v1\0').update(env.JWT_SECRET).digest(); }
export function sealToken(token: string, sessionId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(sessionId));
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unsealToken(value: string, sessionId: string) {
  const packed = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), packed.subarray(0, 12));
  decipher.setAAD(Buffer.from(sessionId)); decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
}

export async function startBrowserSession(challenge: unknown) {
  if (!validSecret(challenge)) throw new BadRequestError('Invalid Google sign-in request.');
  const { origin } = browserConfiguration();
  const sessionId = randomSecret();
  await GoogleBrowserSession.create({ sessionHash: digest(sessionId), challenge, status: 'pending', expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  return { sessionId, browserUrl: `${origin}/auth/google/browser/page?session=${sessionId}`, expiresIn: SESSION_SECONDS };
}

export async function openBrowserSession(sessionId: unknown, existingCookie: string | undefined) {
  if (!validSecret(sessionId)) throw expired();
  const config = browserConfiguration();
  if (validSecret(existingCookie) && await GoogleBrowserSession.exists({ ...active(sessionId), status: 'opened', cookieHash: digest(existingCookie) })) return { ...config, cookie: existingCookie };
  const cookie = randomSecret();
  const session = await GoogleBrowserSession.findOneAndUpdate({ ...active(sessionId), status: 'pending' }, { $set: { status: 'opened', cookieHash: digest(cookie) } });
  if (!session) throw expired();
  return { ...config, cookie };
}

export async function completeBrowserSession(sessionId: unknown, cookie: unknown, token: unknown, cancelled = false) {
  if (!validSecret(sessionId) || !validSecret(cookie)) throw expired();
  const filter = { ...active(sessionId), status: 'opened', cookieHash: digest(cookie) };
  if (!await GoogleBrowserSession.exists(filter)) throw expired();
  if (!cancelled) await verifyFirebaseGoogleIdentity(token, true);
  const result = await GoogleBrowserSession.updateOne(filter, { $set: cancelled ? { status: 'cancelled' } : { status: 'ready', sealedToken: sealToken(token as string, sessionId) } });
  if (!result.modifiedCount) throw expired();
}

export async function pollBrowserSession(sessionId: unknown, verifier: unknown, cancel = false) {
  if (!validSecret(sessionId) || !validSecret(verifier)) throw expired();
  const filter = { ...active(sessionId), challenge: digest(verifier) };
  const completed = await GoogleBrowserSession.findOneAndDelete({ ...filter, ...(cancel ? {} : { status: { $in: ['ready', 'cancelled'] } }) }).select('+sealedToken');
  if (completed) {
    if (cancel || completed.status === 'cancelled') return { status: 'cancelled' as const };
    try { return { status: 'complete' as const, firebaseIdToken: unsealToken(completed.sealedToken!, sessionId) }; }
    catch { throw expired(); }
  }
  if (cancel) return { status: 'cancelled' as const };
  if (!await GoogleBrowserSession.exists(filter)) throw expired();
  return { status: 'pending' as const };
}
