import type { Server } from 'socket.io';

let io: Server | null = null;

export const setRealtimeServer = (server: Server): void => {
  io = server;
};

export const emitBooksChanged = (action: 'created' | 'updated' | 'deleted', bookId: string): void => {
  io?.emit('books:changed', { action, bookId, occurredAt: new Date().toISOString() });
};
