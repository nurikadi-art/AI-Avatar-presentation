import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import {
  requireAuth,
  toMe,
  randomAvatarColor,
  createSession,
  revokeSession,
  revokeUserSessions,
  setSessionCookie,
} from '../lib/perms.js';

const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) });
const acceptBody = z.object({ token: z.string().min(1), name: z.string().min(1), password: z.string().min(8) });
const resetBody = z.object({ token: z.string().min(1), password: z.string().min(8) });

export function registerAuthRoutes(app: FastifyInstance): void {
  const db = app.db;

  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const { email, password } = parsed.data;
    const user = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get();
    if (!user || user.deactivatedAt !== null || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    setSessionCookie(reply, createSession(db, user.id));
    return toMe(user);
  });

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies.sid;
    if (token) revokeSession(db, token);
    reply.clearCookie('sid', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
    return request.user;
  });

  app.post('/api/auth/accept-invite', async (request, reply) => {
    const parsed = acceptBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const { token, name, password } = parsed.data;
    const now = new Date().toISOString();
    const invite = db
      .select()
      .from(schema.invites)
      .where(and(eq(schema.invites.id, token), isNull(schema.invites.usedAt)))
      .get();
    if (!invite || invite.expiresAt <= now) {
      return reply.code(400).send({ error: 'Invalid or expired invite' });
    }
    const email = invite.email.toLowerCase();
    if (db.select().from(schema.users).where(eq(schema.users.email, email)).get()) {
      return reply.code(400).send({ error: 'An account with this email already exists' });
    }
    const userId = nanoid(12);
    db.insert(schema.users).values({
      id: userId,
      email,
      name,
      passwordHash: hashPassword(password),
      avatarColor: randomAvatarColor(),
      isAdmin: false,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: now,
    }).run();
    db.update(schema.invites)
      .set({ usedAt: now })
      .where(and(eq(schema.invites.email, invite.email), isNull(schema.invites.usedAt)))
      .run();
    setSessionCookie(reply, createSession(db, userId));
    const created = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    return toMe(created);
  });

  app.post('/api/auth/reset-password', async (request, reply) => {
    const parsed = resetBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const { token, password } = parsed.data;
    const now = new Date().toISOString();
    const resetRow = db
      .select()
      .from(schema.passwordResets)
      .where(and(eq(schema.passwordResets.id, token), isNull(schema.passwordResets.usedAt)))
      .get();
    if (!resetRow || resetRow.expiresAt <= now) {
      return reply.code(400).send({ error: 'Invalid or expired reset link' });
    }
    db.update(schema.users).set({ passwordHash: hashPassword(password) }).where(eq(schema.users.id, resetRow.userId)).run();
    db.update(schema.passwordResets).set({ usedAt: now }).where(eq(schema.passwordResets.id, token)).run();
    revokeUserSessions(db, resetRow.userId);
    const user = db.select().from(schema.users).where(eq(schema.users.id, resetRow.userId)).get()!;
    setSessionCookie(reply, createSession(db, user.id));
    return toMe(user);
  });
}
