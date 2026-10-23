import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { StoreSubscription, User } from '../models';
import { getGoogleObfuscatedAccountId, verifyStorePurchase } from '../services/storeVerification';
import { syncSubscriptionEntitlement } from '../services/subscriptionEntitlement';
import type { IUser } from '../models/User';

const loadUserWithStoreToken = async (userId: unknown): Promise<IUser | null> => {
  let user = await User.findById(userId).select('+storeAccountToken') as unknown as IUser | null;
  if (!user) return user;
  if (!user.storeAccountToken) {
    await User.updateOne(
      { _id: user._id, $or: [{ storeAccountToken: null }, { storeAccountToken: { $exists: false } }] },
      { $set: { storeAccountToken: crypto.randomUUID() } }
    );
    user = await User.findById(userId).select('+storeAccountToken') as unknown as IUser | null;
  }
  if (user?.storeAccountToken && !user.googleObfuscatedAccountId) {
    const accountId = getGoogleObfuscatedAccountId(user.storeAccountToken);
    await User.updateOne({ _id: user._id }, { $set: { googleObfuscatedAccountId: accountId } });
    user.googleObfuscatedAccountId = accountId;
  }
  return user;
};

export const getStoreAccountToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const user = await loadUserWithStoreToken(req.user._id);
    if (!user) return next(new UnauthorizedError('Not authenticated'));
    if (!user.storeAccountToken) return next(new UnauthorizedError('Could not prepare store account binding'));
    res.json({
      success: true,
      accountToken: user.storeAccountToken,
      googleObfuscatedAccountId: getGoogleObfuscatedAccountId(user.storeAccountToken),
    });
  } catch (err) {
    next(err);
  }
};

export const verifySubscriptionPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const { store, productId, purchaseToken } = req.body as {
      store: 'apple' | 'google';
      productId: string;
      purchaseToken: string;
    };
    const user = await loadUserWithStoreToken(req.user._id);
    if (!user) return next(new UnauthorizedError('Not authenticated'));
    if (!user.storeAccountToken) return next(new UnauthorizedError('Could not prepare store account binding'));

    const verified = await verifyStorePurchase(store, productId, purchaseToken, user.storeAccountToken);
    const existingToken = await StoreSubscription.findOne({
      store,
      purchaseTokenHash: verified.purchaseTokenHash,
    });
    if (existingToken && existingToken.userId.toString() !== user._id.toString()) {
      return next(new ForbiddenError('This store purchase is linked to another HappiNotes account'));
    }
    const existingTransaction = await StoreSubscription.findOne({
      store,
      transactionKey: verified.transactionKey,
    });
    if (existingTransaction && existingTransaction.userId.toString() !== user._id.toString()) {
      return next(new ForbiddenError('This store subscription is linked to another HappiNotes account'));
    }

    await StoreSubscription.findOneAndUpdate(
      { store, transactionKey: verified.transactionKey },
      {
        $set: {
          userId: user._id,
          productId: verified.productId,
          latestTransactionId: verified.latestTransactionId,
          ...(verified.willRenew !== undefined ? { willRenew: verified.willRenew } : {}),
          purchaseTokenHash: verified.purchaseTokenHash,
          state: verified.active ? 'active' : 'expired',
          expiresAt: verified.expiresAt,
          lastVerifiedAt: new Date(),
          ...(verified.signedDate ? { lastStoreEventAt: verified.signedDate } : {}),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await syncSubscriptionEntitlement(user);

    res.json({
      success: true,
      active: verified.active,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePreference: user.languagePreference,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        subscriptionSource: user.subscriptionSource,
      },
      message: verified.active ? 'Subscription verified' : 'No active subscription was found',
    });
  } catch (err) {
    next(err);
  }
};

export const restoreSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const { purchases } = req.body as {
      purchases?: Array<{ store: 'apple' | 'google'; productId: string; purchaseToken: string }>;
    };
    if (!Array.isArray(purchases) || purchases.length > 20) {
      return next(new BadRequestError('A valid purchase list is required'));
    }

    const currentUser = await loadUserWithStoreToken(req.user._id);
    if (!currentUser) return next(new UnauthorizedError('Not authenticated'));
    if (!currentUser.storeAccountToken) return next(new UnauthorizedError('Could not prepare store account binding'));
    const outcomes = [];
    for (const purchase of purchases) {
      const verified = await verifyStorePurchase(
        purchase.store,
        purchase.productId,
        purchase.purchaseToken,
        currentUser.storeAccountToken
      );
      const existingToken = await StoreSubscription.findOne({
        store: purchase.store,
        purchaseTokenHash: verified.purchaseTokenHash,
      });
      if (existingToken && existingToken.userId.toString() !== req.user._id.toString()) {
        return next(new ForbiddenError('This store purchase is linked to another HappiNotes account'));
      }
      const existingTransaction = await StoreSubscription.findOne({
        store: purchase.store,
        transactionKey: verified.transactionKey,
      });
      if (existingTransaction && existingTransaction.userId.toString() !== req.user._id.toString()) {
        return next(new ForbiddenError('This store subscription is linked to another HappiNotes account'));
      }

      await StoreSubscription.findOneAndUpdate(
        { store: purchase.store, transactionKey: verified.transactionKey },
        {
          $set: {
            userId: req.user._id,
            productId: verified.productId,
            latestTransactionId: verified.latestTransactionId,
            ...(verified.willRenew !== undefined ? { willRenew: verified.willRenew } : {}),
            purchaseTokenHash: verified.purchaseTokenHash,
            state: verified.active ? 'active' : 'expired',
            expiresAt: verified.expiresAt,
            lastVerifiedAt: new Date(),
            ...(verified.signedDate ? { lastStoreEventAt: verified.signedDate } : {}),
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
      outcomes.push(verified.active);
    }

    const user = await User.findById(req.user._id);
    if (!user) return next(new UnauthorizedError('Not authenticated'));
    await syncSubscriptionEntitlement(user);
    const active = user.subscriptionStatus === 'premium' && Boolean(
      user.subscriptionExpiry && user.subscriptionExpiry > new Date()
    );

    res.json({
      success: true,
      active: active || user.subscriptionStatus === 'lifetime',
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePreference: user.languagePreference,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        subscriptionSource: user.subscriptionSource,
      },
      verifiedPurchaseCount: outcomes.filter(Boolean).length,
    });
  } catch (err) {
    next(err);
  }
};
