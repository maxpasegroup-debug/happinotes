import { randomUUID } from 'crypto';
import { Content } from '../models';
import { StoreProduct, ProductState } from '../models/StoreProduct';
import { productMapping, Store, ProductMapping } from './storePurchase';
import { provisionGoogle, provisionApple, ProvisioningInput, ProvisioningResult, safeProvisioningError } from './storeProductProviders';
import { AppError, BadRequestError } from '../utils/errors';

export function stableProductId(bookId: string): string {
  if (!/^[a-f\d]{24}$/i.test(bookId)) throw new BadRequestError('Invalid book ID');
  return `happinotes.book.${bookId.toLowerCase()}`;
}
export function isPremiumBook(book: { contentType: string; type: string; priceInr: number }): boolean {
  // New premium books use the shared subscription plans and do not have an
  // individual price. Keep provisioning only for legacy priced books.
  return book.contentType === 'lifebook' && book.type === 'premium' && book.priceInr > 0;
}
export function validatePremiumPrice(book: { contentType: string; type: string; priceInr: number }): void {
  if (isPremiumBook(book) && (!Number.isFinite(book.priceInr) || book.priceInr <= 0)) {
    throw new BadRequestError('Premium books must have a positive priceInr');
  }
}
const state = (productId: string, legacy = false): ProductState => ({
  productId, status: legacy ? 'legacy' : 'pending', attempts: 0, nextAttemptAt: new Date(),
});
async function insertMapping(bookId: string, values: Record<string, unknown>) {
  try {
    return await StoreProduct.updateOne({ bookId }, { $setOnInsert: values }, { upsert: true });
  } catch (error) {
    // Concurrent replicas may insert the same book. A conflicting SKU for another book is still an error.
    if ((error as { code?: number }).code !== 11000 || !await StoreProduct.findOne({ bookId })) throw error;
    return { upsertedCount: 0 };
  }
}

// Import before generating IDs. Never overwrite a stored SKU, including a historical SKU.
export async function migrateLegacyMappings(): Promise<number> {
  const mapping = productMapping();
  await StoreProduct.init();
  let count = 0;
  for (const [bookId, ids] of Object.entries(mapping)) {
    let record = await StoreProduct.findOne({ bookId });
    if (!record) {
      const result = await insertMapping(bookId, {
        bookId, pricingPolicy: 'legacy_preserve',
        ...(ids.android ? { android: state(ids.android, true) } : {}),
        ...(ids.ios ? { ios: state(ids.ios, true) } : {}),
      });
      count += result.upsertedCount;
      record = await StoreProduct.findOne({ bookId });
    }
    for (const store of ['android', 'ios'] as const) {
      if (!ids[store]) continue;
      if (record?.[store] && record[store]!.productId !== ids[store]) {
        throw new AppError('Legacy mapping conflicts with the stored product mapping', 503);
      }
      await StoreProduct.updateOne({ bookId, [store]: { $exists: false } }, { $set: { [store]: state(ids[store]!, true) } });
    }
  }
  return count;
}

export async function ensureBookProducts(book: { id?: string; contentType: string; type: string; priceInr: number }) {
  if (!isPremiumBook(book)) return null;
  validatePremiumPrice(book);
  await migrateLegacyMappings();
  const sku = stableProductId(String(book.id));
  await insertMapping(String(book.id), {
    bookId: book.id, initialPriceInr: book.priceInr, pricingPolicy: 'initial_exact_inr_india_only_v1',
    android: state(sku), ios: state(sku),
  });
  // A legacy map may contain only one platform. Preserve it and provision the missing platform.
  await StoreProduct.updateOne({ bookId: book.id, initialPriceInr: { $exists: false } }, {
    $set: { initialPriceInr: book.priceInr },
  }, { overwriteImmutable: true });
  for (const store of ['android', 'ios'] as const) {
    await StoreProduct.updateOne({ bookId: book.id, [store]: { $exists: false } }, { $set: { [store]: state(sku) } });
  }
  return StoreProduct.findOne({ bookId: book.id });
}

export async function databaseProductMapping(availableOnly = false): Promise<ProductMapping> {
  await migrateLegacyMappings();
  const records = await StoreProduct.find().lean();
  const mapping: ProductMapping = {};
  for (const record of records) {
    const ids: Partial<Record<Store, string>> = {};
    for (const store of ['android', 'ios'] as const) {
      const item = record[store];
      const sandboxReview = store === 'ios' && process.env.APPLE_IAP_ENVIRONMENT === 'Sandbox' && item?.status === 'awaiting_review';
      if (item && (!availableOnly || ['ready', 'legacy'].includes(item.status) || sandboxReview)) ids[store] = item.productId;
    }
    if (Object.keys(ids).length) mapping[String(record.bookId)] = ids;
  }
  return mapping;
}

export async function retryBookProvisioning(bookId: string, store?: Store) {
  const stores: Store[] = store ? [store] : ['android', 'ios'];
  for (const platform of stores) {
    // Do not mutate ready, imported, or currently leased products.
    await StoreProduct.updateOne({ bookId, [`${platform}.status`]: { $in: ['failed', 'awaiting_review', 'pending'] } }, {
      $set: { [`${platform}.status`]: 'pending', [`${platform}.nextAttemptAt`]: new Date() },
      $unset: { [`${platform}.error`]: 1 },
    });
  }
}
export const providers = { android: provisionGoogle, ios: provisionApple };
export async function processStoreProduct(store: Store, bookId?: string,
  provider: (input: ProvisioningInput) => Promise<ProvisioningResult> = providers[store]): Promise<boolean> {
  const now = new Date();
  const owner = randomUUID();
  const filter: Record<string, unknown> = { ...(bookId ? { bookId } : {}), $or: [
    { [`${store}.status`]: { $in: ['pending', 'failed', 'awaiting_review'] }, [`${store}.nextAttemptAt`]: { $lte: now } },
    { [`${store}.status`]: 'processing', [`${store}.leaseUntil`]: { $lte: now } },
  ] };
  const record = await StoreProduct.findOneAndUpdate(filter, { $set: {
    [`${store}.status`]: 'processing', [`${store}.leaseOwner`]: owner,
    [`${store}.leaseUntil`]: new Date(Date.now() + 120000),
  }, $inc: { [`${store}.attempts`]: 1 } }, { new: true, sort: { [`${store}.nextAttemptAt`]: 1 } });
  if (!record) return false;
  const owned = { _id: record._id, [`${store}.leaseOwner`]: owner };
  const heartbeat = setInterval(() => {
    void StoreProduct.updateOne(owned, { $set: { [`${store}.leaseUntil`]: new Date(Date.now() + 120000) } })
      .catch(() => { /* Lease expiry permits recovery after database failure. */ });
  }, 30000);
  heartbeat.unref();
  try {
    const book = await Content.findById(record.bookId);
    if (!book) throw new AppError('Book no longer exists');
    // Unpublishing does not delete/deactivate products. The initial price is immutable.
    const result = await provider({ productId: record[store]!.productId, title: book.title,
      description: book.description, priceInr: record.initialPriceInr!, resourceId: record[store]!.resourceId,
      checkpoint: async (resourceId) => {
        const update = await StoreProduct.updateOne(owned, { $set: { [`${store}.resourceId`]: resourceId } });
        if (!update.matchedCount) throw new AppError('Provisioning lease expired');
      } });
    const fields: Record<string, unknown> = { [`${store}.status`]: result.status,
      [`${store}.storeState`]: result.storeState, [`${store}.lastSyncedAt`]: new Date(),
      [`${store}.nextAttemptAt`]: new Date(Date.now() + 6 * 3600000) };
    if (result.resourceId) fields[`${store}.resourceId`] = result.resourceId;
    await StoreProduct.updateOne(owned, { $set: fields, $unset: {
      [`${store}.error`]: 1, [`${store}.leaseOwner`]: 1, [`${store}.leaseUntil`]: 1,
    } });
  } catch (error) {
    const delay = Math.min(6 * 3600000, 60000 * 2 ** Math.min(record[store]!.attempts, 9));
    await StoreProduct.updateOne(owned, { $set: { [`${store}.status`]: 'failed',
      [`${store}.error`]: safeProvisioningError(error), [`${store}.nextAttemptAt`]: new Date(Date.now() + delay) },
      $unset: { [`${store}.leaseOwner`]: 1, [`${store}.leaseUntil`]: 1 } });
  } finally { clearInterval(heartbeat); }
  return true;
}

// MongoDB is the durable queue. Each replica uses atomic, per-store leases.
export function startProductProvisioningWorker(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await migrateLegacyMappings();
      // Repair a crash between saving a book and creating its provisioning record.
      const existing = await StoreProduct.find().select('bookId android ios').lean();
      const complete = existing.filter((r) => r.android && r.ios).map((r) => r.bookId);
      const books = await Content.find({ _id: { $nin: complete }, contentType: 'lifebook',
        priceInr: { $gt: 0 } }).limit(50);
      for (const book of books) {
        try { await ensureBookProducts(book); } catch { console.error('Could not enqueue book store products'); }
      }
      await Promise.all(['android', 'ios'].map(async (store) => {
        for (let n = 0; n < 10 && await processStoreProduct(store as Store); n++) { /* bounded batch */ }
      }));
    } catch { console.error('Store product provisioning worker failed; will retry'); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, 30000);
  timer.unref();
  return () => clearInterval(timer);
}
