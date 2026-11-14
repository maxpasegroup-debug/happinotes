import type { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { parseDeviceSecurity, recordVpnDetection, securityKey } from '../services/vpnSecurity';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { User } from '../models/User';
import { UserDevice } from '../models/UserDevice';
import { UserNetwork } from '../models/UserNetwork';
import { SecurityBlock } from '../models/SecurityBlock';
import { publicAddress, clean } from '../services/userNetwork';
import { emitUserSecurityChanged } from '../services/realtime';
export async function reportVpn(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'user') throw new ForbiddenError('Customer account required.');
    const report = parseDeviceSecurity(req.body?.deviceSecurity);
    if (!report?.vpn) throw new BadRequestError('VPN detection is required.');
    if (req.installationKey && req.installationKey !== securityKey('installation', report.installationId)) throw new ForbiddenError('Installation does not match this session.');
    const result = await recordVpnDetection(String(req.user!._id), report, req.ip);
    res.json({ success: true, ...result, message: result.banned ? 'Account and app installation banned after five VPN detections.' : 'VPN detected. Session signed out. Turn off VPN before signing in.' });
  } catch (error) { next(error); }
}
export async function moderateIp(req: Request, res: Response, next: NextFunction) {
  try {
    const { action } = req.body || {}, ip = publicAddress(req.body?.ip), reason = clean(req.body?.reason, 500);
    if (!isValidObjectId(req.params.id) || !ip || !reason || !['ban', 'unban'].includes(action)) throw new BadRequestError('Select a reported public IP, action and reason.');
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) throw new BadRequestError('Customer not found.');
    const known = user.vpnLastIp === ip || await UserDevice.exists({ userId: user._id, publicIp: ip }) || await UserNetwork.exists({ userId: user._id, publicIp: ip });
    if (!known) throw new BadRequestError('This IP is not present in the saved user reports.');
    await SecurityBlock.updateOne({ kind: 'ip', key: securityKey('ip', ip) }, { $set: { active: action === 'ban', userId: user._id, reason, actor: String(req.user!._id) } }, { upsert: true });
    emitUserSecurityChanged(String(user._id));
    res.json({ success: true });
  } catch (error) { next(error); }
}
