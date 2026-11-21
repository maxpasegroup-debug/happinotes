import type { ClientSession } from 'mongoose';
import { createHash } from 'crypto';
import { User, type IUser } from '../models/User';
import { SecurityBlock } from '../models/SecurityBlock';
import { AppError, BadRequestError, ForbiddenError } from '../utils/errors';
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
  // The account document is the authoritative atomic ban record; the shared
  // block index also preserves restrictions after account-deletion cleanup.
  const accountFilters = [
    ...(installationKey ? [{ vpnInstallationKeys: installationKey }] : []),
    ...(email ? [{ email: email.trim().toLowerCase() }] : []),
  ];
  if (accountFilters.length && await User.exists({ blocked: true, vpnDetectionCount: { $gte: VPN_BAN_THRESHOLD }, $or: accountFilters })) throw new ForbiddenError('Access is blocked. Contact support to appeal this restriction.');
  if (filters.length && await SecurityBlock.exists({ active: true, $or: filters })) throw new ForbiddenError('Access is blocked. Contact support to appeal this restriction.');
}
/** Counters, incident deduplication, revocation and the installation ban are
 * committed in ONE account update, including on standalone MongoDB. */
export async function recordVpnDetection(userId: string, report: DeviceSecurity, ip?: string) {
  if (report.vpn !== true || !report.incidentId || report.source !== 'android_network') throw new BadRequestError('A detected Android VPN is required.');
  const installationKey = securityKey('installation', report.installationId);
  for (let attempt = 0; attempt < 8; attempt++) {
    const user = await User.findById(userId).select('+vpnHistory +vpnInstallationKeys');
    if (!user || user.role !== 'user') throw new ForbiddenError('Customer account required.');
    const duplicate = user.vpnHistory?.some(item => item.incidentId === report.incidentId);
    const coolingDown = !!user.vpnLastDetectedAt && Date.now() - new Date(user.vpnLastDetectedAt).getTime() < 60000;
    const counted = !duplicate && !coolingDown && !user.blocked;
    const count = (user.vpnDetectionCount || 0) + (counted ? 1 : 0);
    const banned = count >= VPN_BAN_THRESHOLD;
    const now = new Date();
    const updated = await User.findOneAndUpdate({ _id: userId, $or: [{ sessionVersion: user.sessionVersion ?? 0 }, ...((user.sessionVersion ?? 0) === 0 ? [{ sessionVersion: { $exists: false } }] : [])] }, {
      $inc: { sessionVersion: 1, ...(counted ? { vpnDetectionCount: 1 } : {}) },
      $unset: { activeLoginSessionId: 1 },
      $set: { ...(counted ? { vpnLastDetectedAt: now, vpnLastIp: publicAddress(ip) || '' } : {}), ...(banned ? { blocked: true, banExpiresAt: null, banReason: 'VPN policy: five separate detections.' } : {}) },
      ...(counted ? { $addToSet: { vpnInstallationKeys: installationKey }, $push: {
        vpnHistory: { $each: [{ incidentId: report.incidentId, installationKey, publicIp: publicAddress(ip), detectedAt: now }], $slice: -50 },
        ...(banned ? { moderationHistory: { $each: [{ action: 'permanent', reason: 'VPN policy: five separate detections.', actorId: 'system:vpn', at: now }], $slice: -50 } } : {}),
      } } : {}),
    }, { new: true, runValidators: true });
    if (!updated) continue; // A simultaneous login/report changed the version.
    emitUserSecurityChanged(userId);
    return { count, banned, counted };
  }
  throw new AppError('Security state changed. Please retry.', 409);
}

/** Called by deletion cleanup before identifiers are removed. Failure retries
 * the existing deletion checkpoint rather than dropping a permanent block. */
export async function preserveVpnBlocks(user: IUser, session?: ClientSession) {
  if (!user.blocked || (user.vpnDetectionCount || 0) < VPN_BAN_THRESHOLD) return;
  const keys = (user.vpnInstallationKeys || []).map(key => ['installation', key]);
  if (user.email) keys.push(['email', securityKey('email', user.email)]);
  for (const [kind, key] of keys) {
    if (session && await SecurityBlock.exists({ kind, key, active: true }).session(session)) continue;
    await SecurityBlock.updateOne({ kind, key }, { $set: { active: true, userId: user._id, reason: 'VPN policy: five separate detections.', actor: 'system:vpn' } }, { upsert: true, session });
  }
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

export async function detachSecurityBlocks(userId: IUser['_id'], session?: ClientSession) {
  await SecurityBlock.deleteMany({ userId, active: false }, { session });
  await SecurityBlock.updateMany({ userId, active: true }, {
    $unset: { userId: 1, actor: 1 },
    $set: { reason: 'Security restriction retained after account deletion.' },
  }, { session });
}
