import type { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { User } from '../models/User';
import { randomUUID } from 'crypto';
import { UserDevice } from '../models/UserDevice';
import { DeviceReferenceCache } from '../models/DeviceReferenceCache';
import { DEVICE_REFERENCE_VERSION, deviceModelKey, referenceTtl, validateDeviceReference } from '../services/deviceReferenceCache';
import { UserNetwork } from '../models/UserNetwork';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { moderationStatus, parseBan } from '../services/accountModeration';
import { clean, publicAddress, parseNetwork, lookupNetwork } from '../services/userNetwork';
import { requestAccountDeletion } from '../services/accountDeletion';
import { emitUserSecurityChanged, emitUserDevicesChanged } from '../services/realtime';

export function createDeviceIdentity(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ installationId: randomUUID() });
}

export async function recordNetwork(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseNetwork(req.body || {});
    // Express resolves req.ip using the configured trusted reverse proxy.
    // Never accept body.publicIp or arbitrary forwarding headers from clients.
    const publicIp = publicAddress(req.ip);
    const installationId = req.body?.installationId;
    if (installationId !== undefined && (typeof installationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(installationId))) throw new BadRequestError('Invalid installation ID.');
    // Old builds keep the legacy snapshot; new builds never merge devices by model/IP.
    const filter = { userId: req.user!._id, ...(installationId ? { installationId: installationId.toLowerCase() } : {}) };
    const previous = installationId ? await UserDevice.findOne(filter).lean() : await UserNetwork.findOne(filter).lean();
    const lookupTtl = previous?.geo?.status === 'approximate' ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
    const configuredNow = previous?.geo?.status === 'not_configured' && process.env.SECURITY_GEOIP_PROVIDER === 'ipapi.co';
    const refresh = configuredNow || previous?.publicIp !== publicIp || !previous?.geo?.checkedAt || Date.now() - new Date(previous.geo.checkedAt).getTime() > lookupTtl;
    const lastSeen = new Date();
    const update = { $set: { ...input, publicIp: publicIp || '', lastSeen }, ...(installationId ? { $setOnInsert: { firstSeen: lastSeen } } : {}) };
    if (installationId) {
      try { await UserDevice.updateOne(filter, update, { upsert: true, runValidators: true }); }
      catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        await UserDevice.updateOne(filter, update, { runValidators: true });
      }
    } else await UserNetwork.updateOne(filter, update, { upsert: true });
    if (!previous || previous.publicIp !== publicIp || previous.deviceModel !== input.deviceModel || previous.networkType !== input.networkType) emitUserDevicesChanged();
    res.json({ success: true });
    if (refresh) {
      const geo = await lookupNetwork(publicIp);
      const currentReport = { ...filter, publicIp: publicIp || '', lastSeen };
      if (installationId) await UserDevice.updateOne(currentReport, { $set: { geo } });
      else await UserNetwork.updateOne(currentReport, { $set: { geo } });
      emitUserDevicesChanged();
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
    const devices = await UserDevice.find({ userId: { $in: users.map(user => user._id) } }).select('-installationId').sort({ lastSeen: -1, _id: -1 }).lean();
    const byUser = new Map(networks.map(network => [String(network.userId), network]));
    const deviceGroups = new Map<string, typeof devices>();
    for (const device of devices) {
      const id = String(device.userId);
      deviceGroups.set(id, [...(deviceGroups.get(id) || []), device]);
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ users: users.map(user => ({ id: user._id, name: user.name, email: user.email, ...moderationStatus(user), history: user.moderationHistory || [], devices: deviceGroups.get(String(user._id)) || [], network: deviceGroups.get(String(user._id))?.[0] || byUser.get(String(user._id)) || null })), page, total, totalPages: Math.ceil(total / 7) });
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

// Resolve the model from a saved record, never a caller-supplied search string.
async function reportedDeviceModel(req: Request): Promise<string> {
  if (!isValidObjectId(req.params.id)) throw new BadRequestError('Invalid user ID.');
  const user = await User.findById(req.params.id).select('role');
  if (!user || user.role !== 'user') throw new NotFoundError('User not found.');
  const deviceId = req.query.deviceId;
  if (deviceId !== undefined && (typeof deviceId !== 'string' || !isValidObjectId(deviceId))) throw new BadRequestError('Invalid device ID.');
  const report = deviceId
    ? await UserDevice.findOne({ _id: deviceId, userId: req.params.id }).lean()
    : await UserNetwork.findOne({ userId: req.params.id }).lean();
  const model = clean(report?.deviceModel);
  if (!model) throw new NotFoundError('Device model not reported.');
  return model;
}
export async function getDeviceReference(req: Request, res: Response, next: NextFunction) {
  try {
    const model = await reportedDeviceModel(req);
    const saved = await DeviceReferenceCache.findOne({ modelKey: deviceModelKey(model), version: DEVICE_REFERENCE_VERSION, expiresAt: { $gt: new Date() } }).lean();
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(saved ? { photo: { ...saved.photo, model }, checkedAt: saved.checkedAt, expiresAt: saved.expiresAt } : { photo: null });
  } catch (error) { next(error); }
}
export async function saveDeviceReference(req: Request, res: Response, next: NextFunction) {
  try {
    const model = await reportedDeviceModel(req);
    const photo = validateDeviceReference(req.body?.photo, model);
    const checkedAt = new Date(), expiresAt = new Date(checkedAt.getTime() + referenceTtl(photo.status));
    const filter = { modelKey: deviceModelKey(model) };
    const update = { $set: { version: DEVICE_REFERENCE_VERSION, photo, checkedAt, expiresAt } };
    try { await DeviceReferenceCache.updateOne(filter, update, { upsert: true, runValidators: true }); }
    catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      await DeviceReferenceCache.updateOne(filter, update, { runValidators: true });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, checkedAt, expiresAt });
  } catch (error) { next(error); }
}
