import { User } from '../models/User';
import type { Server } from 'socket.io';

export type CatalogChangeAction = 'created' | 'updated' | 'deleted';

let socketServer: Server | null = null;

export function registerRealtimeServer(server: Server): void {
  socketServer = server;
}

export function emitCatalogChanged(
  action: CatalogChangeAction,
  bookId: string,
  contentType?: string
): void {
  socketServer?.emit('books:changed', {
    action,
    bookId,
    contentType,
    occurredAt: new Date().toISOString(),
  });
}

/** Invalidation only: clients refetch through the existing published/access filters. */
export function emitHappyBitesChanged(): void {
  socketServer?.emit('happy-bites:changed', {
    occurredAt: new Date().toISOString(),
  });
}

/**
 * Notify connected mobile clients that the shared monthly/yearly prices have
 * changed.  The subscription endpoint remains the source of truth; this event
 * only tells clients to fetch the latest values without requiring an app
 * restart or a manual refresh.
 */
export function emitSubscriptionPlansChanged(planKey?: 'monthly' | 'yearly'): void {
  socketServer?.emit('subscription-plans:changed', {
    planKey,
    occurredAt: new Date().toISOString(),
  });
}

/** Invalidation only: account details and status credentials stay in the admin API. */
export function emitAccountDeletionsChanged(): void {
  socketServer?.of('/admin').emit('account-deletions:changed', {
    occurredAt: new Date().toISOString(),
  });
}


/** Only authenticated, server-assigned account rooms receive this invalidation. */
export function emitUserSecurityChanged(userId: string): void {
  socketServer?.of('/account').to(`account:${userId}`).emit('account:changed');
  socketServer?.of('/admin').emit('users:changed');
}


/** Fan out committed account changes on every replica, not only the API server
 * that accepted the admin mutation. Client polling remains the outage fallback. */
export function watchUserSecurityChanges(): () => void {
  let stopped = false;
  let stream: ReturnType<typeof User.watch> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const start = () => {
    if (stopped) return;
    stream = User.watch([{ $match: { $or: [
      { operationType: 'update', 'updateDescription.updatedFields.blocked': { $exists: true } },
      { operationType: 'update', 'updateDescription.updatedFields.sessionVersion': { $exists: true } },
      { operationType: 'update', 'updateDescription.updatedFields.deletionState': { $exists: true } },
      { operationType: { $in: ['replace', 'delete'] } },
    ] } }]);
    stream.on('change', change => {
      if ('documentKey' in change) emitUserSecurityChanged(String(change.documentKey._id));
    });
    let reconnecting = false;
    const reconnect = () => {
      if (stopped || reconnecting) return;
      reconnecting = true;
      void stream?.close().catch(() => {});
      retry = setTimeout(start, 5000);
      retry.unref();
    };
    stream.on('error', reconnect);
    stream.on('close', reconnect);
  };
  start();
  return () => { stopped = true; if (retry) clearTimeout(retry); void stream?.close().catch(() => {}); };
}
