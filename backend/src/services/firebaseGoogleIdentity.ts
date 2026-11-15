import { getFirebaseAuth } from './firebaseAdmin';
import { googlePhotoUrl } from './googleIdentity';
import { AppError, UnauthorizedError } from '../utils/errors';

/** Accept only Google-provider Firebase sessions from our configured project. */
export async function verifyFirebaseGoogleIdentity(token: unknown, recent = false) {
  if (typeof token !== 'string' || token.length < 100 || token.length > 12000) throw new UnauthorizedError('Google verification failed. Please try again.');
  const auth = getFirebaseAuth();
  if (!auth) throw new AppError('Google sign-in is not available yet. Please use email sign-in.', 503);
  try {
    // Firebase Admin verifies project audience/issuer/signature/expiry; true also
    // rejects revoked sessions and disabled Firebase accounts.
    const claims = await auth.verifyIdToken(token, true);
    const subject = claims.firebase?.identities?.['google.com']?.[0];
    const now = Date.now() / 1000;
    if (claims.firebase?.sign_in_provider !== 'google.com' || typeof subject !== 'string' || !subject ||
        !claims.uid || !claims.email || claims.email_verified !== true || claims.exp <= now) throw new Error('Invalid provider');
    if (recent && (!claims.auth_time || now - claims.auth_time > 300 || claims.auth_time > now + 60)) throw new Error('Fresh sign-in required');
    return { subject, email: claims.email.trim().toLowerCase(), name: String(claims.name || claims.email.split('@')[0]).trim().slice(0, 160), photoUrl: googlePhotoUrl(claims.picture) };
  } catch {
    throw new UnauthorizedError('Google verification failed. Please choose your Google account again.');
  }
}
