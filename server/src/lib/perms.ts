import type { FastifyReply, FastifyRequest } from 'fastify';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, eq, gt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import * as schema from '../db/schema.js';
import { LABEL_HEX, type LabelColor, type Me, type UserPublic } from '@shared/types';

type Db = BetterSQLite3Database<typeof schema>;
type UserRow = typeof schema.users.$inferSelect;

export const SESSION_COOKIE = 'sid';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const AVATAR_COLORS = Object.keys(LABEL_HEX) as LabelColor[];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function toUserPublic(u: UserRow): UserPublic {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarColor: u.avatarColor,
    isAdmin: u.isAdmin,
    deactivated: u.deactivatedAt !== null,
  };
}

export function toMe(u: UserRow): Me {
  return { ...toUserPublic(u), emailNotifications: u.emailNotifications };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS_MS / 1000,
  };
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export function createSession(db: Db, userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  db.insert(schema.sessions).values({ id: token, userId, expiresAt }).run();
  return token;
}

export function revokeSession(db: Db, token: string): void {
  db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
}

export function revokeUserSessions(db: Db, userId: string): void {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const db = request.server.db;
  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  const now = new Date().toISOString();
  const session = db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, now)))
    .get();
  if (!session) {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
  if (!user || user.deactivatedAt !== null) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  db.update(schema.sessions)
    .set({ expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString() })
    .where(eq(schema.sessions.id, token))
    .run();
  setSessionCookie(reply, token);
  request.user = toMe(user);
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user?.isAdmin) {
    reply.code(403).send({ error: 'Admin only' });
  }
}

export function canAccessBoard(db: Db, userId: string, boardId: string): boolean {
  const board = db.select().from(schema.boards).where(eq(schema.boards.id, boardId)).get();
  if (!board) return false;
  if (board.visibility === 'team') return true;
  const member = db
    .select()
    .from(schema.boardMembers)
    .where(and(eq(schema.boardMembers.boardId, boardId), eq(schema.boardMembers.userId, userId)))
    .get();
  if (member) return true;
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  return !!user && user.isAdmin;
}
