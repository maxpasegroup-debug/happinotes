import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { User, type IUser } from '../models/User';
import { VpnIncident } from '../models/VpnIncident';
import { SecurityBlock } from '../models/SecurityBlock';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { publicAddress } from './userNetwork';
import { emitUserSecurityChanged } from './realtime';

export const VPN_BAN_THRESHOLD = 5;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export type DeviceSecurity = { installationId: string; vpn: boolean | null; incidentId?: string; source: 'android_network' | 'unavailable' };
export function securityKey(kind: string, value: string) { return createHash('sha256').update(`${kind}:${value.trim().toLowerCase()}`).digest('hex'); }
export function parseDeviceSecurity(input: unknown): DeviceSecurity | undefined {
  if (input === undefined) return undefined; // older clients are not device-attested
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestError('Invalid device security report.');
  const data = input as Record<string, unknown>;
  if (typeof data.installationId !== 'string' || !UUID.test(data.installationId) || ![true, false, null].includes(data.vpn as boolean | null) ||
      !['android_network', 'unavailable'].includes(String(data.source)) ||
      (data.source === 'unavailable' && data.vpn !== null) ||
      (data.vpn === true && (data.source !== 'android_network' || typeof data.incidentId !== 'string' || !UUID.test(data.incidentId)))) throw new BadRequestError('Invalid device security report.');
  return { installationId: data.installationId.toLowerCase(), vpn: data.vpn as boolean | null, source: data.source as DeviceSecurity['source'], ...(data.vpn === true ? { incidentId: String(data.incidentId).toLowerCase() } : {}) };
}
export async function assertNoSecurityBlock(installationKey?: string, ip?: string, email?: string) {
  const address = publicAddress(ip);
  const filters = [
    ...(installationKey ? [{ kind: 'installation', key: installationKey }] : []),
    ...(address ? [{ kind: 'ip', key: securityKey('ip', address) }] : []),
    ...(email ? [{ kind: 'email', key: securityKey('email', email) }] : []),
  ];
  if (filters.length && await SecurityBlock.exists({ active: true, $or: filters })) throw new ForbiddenError('Access is blocked. Contact support to appeal this restriction.');
}
/** Client-reported VPN policy incidents, never represented as proven fraud.
 * Transaction makes deduplication, count, revocation and threshold blocks atomic. */
export async function recordVpnDetection(userId: string, report: DeviceSecurity, ip?: string) {
  if (report.vpn !== true || !report.incidentId || report.source !== 'android_network') throw new BadRequestError('A detected Android VPN is required.');
  const installationKey = securityKey('installation', report.installationId);
  let result = { count: 0, banned: false, counted: false };
  await mongoose.connection.transaction(async session => {
    const user = await User.findById(userId).session(session);
    if (!user || user.role !== 'user') throw new ForbiddenError('Customer account required.');
    const duplicate = await VpnIncident.exists({ userId, incidentId: report.incidentId }).session(session);
    // Network handovers/retries cannot accumulate strikes in quick succession.
    const coolingDown = !!user.vpnLastDetectedAt && Date.now() - new Date(user.vpnLastDetectedAt).getTime() < 60000;
    const counted = !duplicate && !coolingDown && !user.blocked;
    const count = (user.vpnDetectionCount || 0) + (counted ? 1 : 0);
    const banned = count >= VPN_BAN_THRESHOLD;
    const now = new Date();
    if (counted) await VpnIncident.create([{ userId, incidentId: report.incidentId, installationKey, publicIp: publicAddress(ip), detectedAt: now, source: report.source }], { session });
    await User.updateOne({ _id: userId }, {
      $inc: { sessionVersion: 1, ...(counted ? { vpnDetectionCount: 1 } : {}) },
      $unset: { activeLoginSessionId: 1 },
      $set: { ...(counted ? { vpnLastDetectedAt: now, vpnLastIp: publicAddress(ip) || '' } : {}), ...(banned ? { blocked: true, banExpiresAt: null, banReason: 'VPN policy: five separate detections.' } : {}) },
      ...(banned && counted ? { $push: { moderationHistory: { $each: [{ action: 'permanent', reason: 'VPN policy: five separate detections.', actorId: 'system:vpn', at: now }], $slice: -50 } } } : {}),
    }, { session });
    if (banned) {
      for (const [kind, key] of [['installation', installationKey], ...(user.email ? [['email', securityKey('email', user.email)]] : [])]) {
        await SecurityBlock.updateOne({ kind, key }, { $set: { active: true, userId, reason: 'VPN policy: five separate detections.', actor: 'system:vpn' } }, { upsert: true, session });
      }
    }
    result = { count, banned, counted };
  });
  emitUserSecurityChanged(userId);
  return result;
}
export async function checkVpnLogin(user: IUser, input: unknown, ip?: string): Promise<string | undefined> {
  if (user.role === 'admin') return undefined;
  const report = parseDeviceSecurity(input);
  const key = report ? securityKey('installation', report.installationId) : undefined;
  await assertNoSecurityBlock(key, ip, user.email);
  if (report?.vpn) {
    const result = await recordVpnDetection(String(user._id), report, ip);
    throw new ForbiddenError(result.banned ? 'Account and app installation banned after five VPN detections. Contact support to appeal.' : `VPN detected. Turn off the VPN before signing in. Detection ${result.count} of ${VPN_BAN_THRESHOLD}.`);
  }
  return key;
}
