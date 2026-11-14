import type { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { User } from '../models/User';
import { UserNetwork } from '../models/UserNetwork';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { moderationStatus, parseBan } from '../services/accountModeration';
import { clean, publicAddress, parseNetwork, lookupNetwork } from '../services/userNetwork';
import { requestAccountDeletion } from '../services/accountDeletion';
import { emitUserSecurityChanged } from '../services/realtime';

export async function recordNetwork(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseNetwork(req.body || {});
    // Express resolves req.ip using the configured trusted reverse proxy.
    // Never accept body.publicIp or arbitrary forwarding headers from clients.
    const publicIp = publicAddress(req.ip);
    const previous = await UserNetwork.findOne({ userId: req.user!._id }).lean();
    const lookupTtl = previous?.geo?.status === 'approximate' ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
    const configuredNow = previous?.geo?.status === 'not_configured' && process.env.SECURITY_GEOIP_PROVIDER === 'ipapi.co';
    const refresh = configuredNow || previous?.publicIp !== publicIp || !previous?.geo?.checkedAt || Date.now() - new Date(previous.geo.checkedAt).getTime() > lookupTtl;
    const lastSeen = new Date();
    await UserNetwork.updateOne({ userId: req.user!._id }, { $set: { ...input, publicIp: publicIp || '', lastSeen } }, { upsert: true });
    res.json({ success: true });
    if (refresh) {
      const geo = await lookupNetwork(publicIp);
      await UserNetwork.updateOne({ userId: req.user!._id, publicIp: publicIp || '', lastSeen }, { $set: { geo } });
    }
  } catch (error) { if (!res.headersSent) next(error); }
}

export async function listUserSecurity(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Math.min(100000, Number.parseInt(String(req.query.page || '1'), 10) || 1));
    const search = clean(req.query.query, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: Record<string, unknown> = { role: 'user' };
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const [users, total] = await Promise.all([
      User.find(filter).select('_id name email blocked banExpiresAt banReason deletionState sessionVersion +moderationHistory').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 7).limit(7).lean(),
      User.countDocuments(filter),
    ]);
    const networks = await UserNetwork.find({ userId: { $in: users.map(user => user._id) } }).lean();
    const byUser = new Map(networks.map(network => [String(network.userId), network]));
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ users: users.map(user => ({ id: user._id, name: user.name, email: user.email, ...moderationStatus(user), history: user.moderationHistory || [], network: byUser.get(String(user._id)) || null })), page, total, totalPages: Math.ceil(total / 7) });
  } catch (error) { next(error); }
}

export async function moderateUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isValidObjectId(req.params.id)) throw new BadRequestError('Invalid user ID.');
    const { action, reason, expiry } = parseBan(req.body || {});
    const user = await User.findById(req.params.id).select('role deletionState sessionVersion');
    if (!user) throw new NotFoundError('User not found.');
    if (user.role === 'admin' || String(user._id) === String(req.user!._id)) throw new ForbiddenError('Administrators cannot be moderated here.');
    if (user.deletionState && user.deletionState !== 'active') throw new BadRequestError('Deletion is already in progress.');
    const updated = await User.findOneAndUpdate({ _id: user._id, role: 'user', $and: [{ $or: [{ sessionVersion: user.sessionVersion ?? 0 }, ...(user.sessionVersion ? [] : [{ sessionVersion: { $exists: false } }])] }, { $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }] }] }, {
      $set: { blocked: action !== 'unban', banReason: action === 'unban' ? '' : reason, banExpiresAt: expiry },
      $inc: { sessionVersion: 1 },
      $push: { moderationHistory: { $each: [{ action, reason, actorId: String(req.user!._id), at: new Date(), ...(expiry ? { expiresAt: expiry } : {}) }], $slice: -50 } },
    }, { new: true, runValidators: true });
    if (!updated) throw new AppError('Account changed. Refresh and try again.', 409);
    emitUserSecurityChanged(String(updated._id));
    res.json({ success: true, ...moderationStatus(updated) });
  } catch (error) { next(error); }
}

export async function deleteUserAccount(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isValidObjectId(req.params.id)) throw new BadRequestError('Invalid user ID.');
    const user = await User.findById(req.params.id).select('role email');
    if (!user) throw new NotFoundError('User not found.');
    if (user.role === 'admin' || String(user._id) === String(req.user!._id)) throw new ForbiddenError('Administrators cannot be deleted here.');
    if (req.body?.confirmation !== 'DELETE' || !clean(req.body?.reason, 500)) throw new BadRequestError('Enter DELETE and a reason to confirm.');
    // Queue the established transactional cleanup; do not orphan purchases or
    // silently skip its retention/entitlement checkpoints with deleteOne().
    const result = await requestAccountDeletion(user._id, `admin-delete:${user._id}`, 'admin', String(req.user!._id));
    await User.updateOne({ _id: user._id, 'moderationHistory.action': { $ne: 'delete' } }, { $inc: { sessionVersion: 1 }, $push: { moderationHistory: { $each: [{ action: 'delete', reason: clean(req.body.reason, 500), actorId: String(req.user!._id), at: new Date() }], $slice: -50 } } });
    emitUserSecurityChanged(String(user._id));
    res.status(202).json({ success: true, reference: result.publicReference, status: 'deletion_pending', message: 'Account access revoked. Deletion has entered the existing cleanup workflow.' });
  } catch (error) { next(error); }
}
