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

export function emitNotification(payload: {
  title: string;
  message: string;
  target: string;
  imageUrl?: string;
}): void {
  socketServer?.emit('notification:new', {
    ...payload,
    occurredAt: new Date().toISOString(),
  });
}
