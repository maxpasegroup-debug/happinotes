import { OAuth2Client } from 'google-auth-library';
import { AppError, UnauthorizedError } from '../utils/errors';

const client = new OAuth2Client();
export function googlePhotoUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.hostname.endsWith('.googleusercontent.com') ? url.href : undefined;
  } catch { return undefined; }
}

/** Verify the Google issuer, signature, expiry and this application's audience. */
export async function verifyGoogleIdentity(idToken: unknown, recent = false) {
  const audience = process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID?.trim();
  if (!audience) throw new AppError('Google sign-in is not available yet. Please use email sign-in.', 503);
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 12000) throw new UnauthorizedError('Google verification failed. Please try again.');
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    const claims = ticket.getPayload();
    if (!claims?.sub || !claims.email || claims.email_verified !== true || !claims.exp || claims.exp * 1000 <= Date.now()) throw new Error('Invalid identity');
    if (recent && (!claims.iat || Date.now() - claims.iat * 1000 > 5 * 60_000 || claims.iat * 1000 > Date.now() + 60_000)) throw new Error('Recent identity required');
    return { subject: claims.sub, email: claims.email.trim().toLowerCase(), name: (claims.name || claims.email.split('@')[0]).trim().slice(0, 160), photoUrl: googlePhotoUrl(claims.picture) };
  } catch {
    // Never pass provider diagnostics, tokens or request URLs to the client.
    throw new UnauthorizedError('Google verification failed. Please choose your Google account again.');
  }
}
