import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { and, eq, gt, inArray } from 'drizzle-orm';
import * as schema from './db/schema';
import { canAccessBoard, SESSION_COOKIE } from './lib/perms';
import type { Db } from './db/index';
import type { BoardChangedEvent, PresenceEvent } from '@shared/types';

interface SocketData {
  userId: string;
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

const roomOf = (boardId: string): string => `board:${boardId}`;

export function setupRealtime(server: HttpServer, db: Db) {
  const io = new Server(server, { serveClient: false });

  io.use((socket, next) => {
    const token = parseCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
    if (!token) return next(new Error('unauthorized'));
    const now = new Date().toISOString();
    const session = db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, now)))
      .get();
    if (!session) return next(new Error('unauthorized'));
    const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
    if (!user || user.deactivatedAt !== null) return next(new Error('unauthorized'));
    (socket.data as SocketData).userId = user.id;
    next();
  });

  async function broadcastPresence(boardId: string): Promise<void> {
    const room = roomOf(boardId);
    const sockets = await io.in(room).fetchSockets();
    const userIds = [...new Set(sockets.map((s) => (s.data as SocketData).userId))];
    const users = userIds.length
      ? db
          .select({ id: schema.users.id, name: schema.users.name, avatarColor: schema.users.avatarColor })
          .from(schema.users)
          .where(inArray(schema.users.id, userIds))
          .all()
      : [];
    const payload: PresenceEvent = { boardId, users };
    io.to(room).emit('board:presence', payload);
  }

  io.on('connection', (socket) => {
    const userId = (socket.data as SocketData).userId;

    socket.on('board:join', async (arg: { boardId?: unknown }) => {
      const boardId = arg?.boardId;
      if (typeof boardId !== 'string') return;
      if (!canAccessBoard(db, userId, boardId)) return;
      await socket.join(roomOf(boardId));
      await broadcastPresence(boardId);
    });

    socket.on('board:leave', async (arg: { boardId?: unknown }) => {
      const boardId = arg?.boardId;
      if (typeof boardId !== 'string') return;
      await socket.leave(roomOf(boardId));
      await broadcastPresence(boardId);
    });

    socket.on('disconnecting', () => {
      const boardIds = [...socket.rooms]
        .filter((r) => r.startsWith('board:'))
        .map((r) => r.slice('board:'.length));
      setImmediate(() => {
        for (const boardId of boardIds) void broadcastPresence(boardId);
      });
    });
  });

  function emitBoardChanged(boardId: string, byUserId: string): void {
    const payload: BoardChangedEvent = { boardId, byUserId };
    io.to(roomOf(boardId)).emit('board:changed', payload);
  }

  return { io, emitBoardChanged };
}
