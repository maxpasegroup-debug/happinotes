import type { Request, Response } from 'express';
import type { Server, Socket } from 'socket.io';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

export async function authorizeAdminRealtime(socket: Pick<Socket, 'handshake'>, next: (error?: Error) => void): Promise<void> {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token || token.length > 8192) {
    next(new Error('Admin authentication required'));
    return;
  }
  const req = { headers: { authorization: `Bearer ${token}` } } as Request;
  const res = {} as Response;
  await authenticate(req, res, (error) => {
    if (error) { next(new Error('Admin authentication required')); return; }
    requireAdmin(req, res, (denied) => next(denied ? new Error('Admin access required') : undefined));
  });
}

export function registerAdminRealtime(server: Server): void {
  server.of('/admin').use((socket, next) => { void authorizeAdminRealtime(socket, next); });
}
