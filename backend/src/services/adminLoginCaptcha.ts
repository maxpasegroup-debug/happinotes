import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { model, Schema } from 'mongoose';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

// The package's bundled typings omit its callable SVG renderer.
const renderCode: (code: string, options: { width: number; height: number; noise: number; fontSize: number }) => string = require('svg-captcha');

const schema = new Schema({
  _id: { type: String, required: true },
  nonce: { type: String, required: true },
  digest: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
export const AdminLoginCaptcha = model('AdminLoginCaptcha', schema);

function digest(...parts: string[]) {
  return createHmac('sha256', env.JWT_SECRET).update(JSON.stringify(['admin-login-captcha', ...parts])).digest('hex');
}

export function captchaOwner(email: unknown, ip: string | undefined) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new BadRequestError('Enter a valid admin email.');
  }
  return digest('owner', email.trim().toLowerCase(), ip || '');
}

export async function issueAdminCaptcha(owner: string) {
  const id = randomBytes(24).toString('hex');
  const code = randomInt(1000000).toString().padStart(6, '0');
  const image = renderCode(code, { width: 204, height: 64, noise: 3, fontSize: 46 });
  await AdminLoginCaptcha.updateOne({ _id: owner }, { $set: {
    nonce: id, digest: digest('answer', id, code), expiresAt: new Date(Date.now() + 5 * 60_000),
  } }, { upsert: true });
  return { id, image: 'data:image/svg+xml;base64,' + Buffer.from(image).toString('base64') };
}

export async function consumeAdminCaptcha(owner: string, id: unknown, answer: unknown) {
  if (typeof id !== 'string' || !/^[a-f0-9]{48}$/.test(id)) return false;
  // Consume even a wrong guess. An expired or previously rotated challenge cannot authorize a login.
  const row = await AdminLoginCaptcha.findOneAndDelete({ _id: owner, nonce: id, expiresAt: { $gt: new Date() } }).lean();
  if (!row || typeof answer !== 'string' || !/^\d{6}$/.test(answer)) return false;
  return timingSafeEqual(Buffer.from(row.digest, 'hex'), Buffer.from(digest('answer', id, answer), 'hex'));
}
