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
