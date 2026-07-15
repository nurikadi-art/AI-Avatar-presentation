import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, isNotNull, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { requireAuth, requireAdmin, revokeUserSessions, toUserPublic } from '../lib/perms';
import { sendEmail } from '../lib/email';
import type { Db } from '../db/index';
import type { AppDeps } from '../app';
import type { BoardSummary, LabelColor } from '@shared/types';
import {
  users, invites, passwordResets, boards, boardMembers, lists, cards,
  cardAssignees, labels, cardLabels, checklistItems, comments, attachments, activity, notifications,
} from '../db/schema';

const inviteSchema = z.object({ email: z.string().email() });
const patchMemberSchema = z.object({ deactivated: z.boolean().optional(), isAdmin: z.boolean().optional() });
const purgeSchema = z.object({ entity: z.enum(['board', 'list', 'card']), id: z.string().min(1) });
const restoreSchema = z.object({ entity: z.literal('board'), id: z.string().min(1) });

function newToken(): string {
  return randomBytes(24).toString('hex');
}

function appUrl(): string {
  return (process.env.APP_URL ?? '').replace(/\/$/, '');
}

async function purgeCards(db: Db, dataDir: string, cardIds: string[]): Promise<void> {
  if (!cardIds.length) return;
  const atts = db.select().from(attachments).where(inArray(attachments.cardId, cardIds)).all();
  for (const a of atts) {
    await fs.rm(path.join(dataDir, 'uploads', a.storedName), { force: true });
  }
  db.delete(attachments).where(inArray(attachments.cardId, cardIds)).run();
  db.delete(cardAssignees).where(inArray(cardAssignees.cardId, cardIds)).run();
  db.delete(cardLabels).where(inArray(cardLabels.cardId, cardIds)).run();
  db.delete(checklistItems).where(inArray(checklistItems.cardId, cardIds)).run();
  db.delete(comments).where(inArray(comments.cardId, cardIds)).run();
  db.delete(notifications).where(inArray(notifications.cardId, cardIds)).run();
  db.delete(activity).where(inArray(activity.cardId, cardIds)).run();
  db.delete(cards).where(inArray(cards.id, cardIds)).run();
}

export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db } = deps;

  app.post('/api/admin/invites', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid email' });
    const email = parsed.data.email.toLowerCase();
    const now = new Date().toISOString();

    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      const token = newToken();
      db.insert(passwordResets).values({
        id: token,
        userId: existing.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        usedAt: null,
      }).run();
      const link = `${appUrl()}/reset/${token}`;
      void sendEmail({ to: email, subject: 'Reset your password', html: `<p><a href="${link}">Set a new password</a></p>` });
      return reply.send({ link });
    }

    db.update(invites).set({ usedAt: now }).where(and(eq(invites.email, email), isNull(invites.usedAt))).run();
    const token = newToken();
    db.insert(invites).values({
      id: token,
      email,
      invitedBy: req.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      usedAt: null,
    }).run();
    const link = `${appUrl()}/invite/${token}`;
    void sendEmail({ to: email, subject: 'You are invited', html: `<p><a href="${link}">Accept your invitation</a></p>` });
    return reply.send({ link });
  });

  app.get('/api/admin/members', { preHandler: [requireAuth, requireAdmin] }, async (_req, reply) => {
    const members = db.select().from(users).all().map(toUserPublic);
    const usage = db.select({ total: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)` }).from(attachments).get();
    const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    return reply.send({ members, diskUsageBytes: usage?.total ?? 0, emailConfigured });
  });

  app.patch('/api/admin/members/:id', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = patchMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const target = db.select().from(users).where(eq(users.id, id)).get();
    if (!target) return reply.code(404).send({ error: 'Member not found' });
    if (id === req.user.id && parsed.data.deactivated === true) {
      return reply.code(400).send({ error: 'You cannot deactivate yourself' });
    }
    const updates: Partial<{ deactivatedAt: string | null; isAdmin: boolean }> = {};
    if (parsed.data.deactivated !== undefined) updates.deactivatedAt = parsed.data.deactivated ? new Date().toISOString() : null;
    if (parsed.data.isAdmin !== undefined) updates.isAdmin = parsed.data.isAdmin;
    if (Object.keys(updates).length) db.update(users).set(updates).where(eq(users.id, id)).run();
    if (parsed.data.deactivated === true) revokeUserSessions(db, id);
    const updated = db.select().from(users).where(eq(users.id, id)).get()!;
    return reply.send(toUserPublic(updated));
  });

  app.post('/api/admin/members/:id/reset-password', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const target = db.select().from(users).where(eq(users.id, id)).get();
    if (!target) return reply.code(404).send({ error: 'Member not found' });
    const token = newToken();
    db.insert(passwordResets).values({
      id: token,
      userId: id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      usedAt: null,
    }).run();
    revokeUserSessions(db, id);
    const link = `${appUrl()}/reset/${token}`;
    void sendEmail({ to: target.email, subject: 'Password reset', html: `<p><a href="${link}">Set a new password</a></p>` });
    return reply.send({ link });
  });

  app.post('/api/admin/purge', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const parsed = purgeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const { entity, id } = parsed.data;

    if (entity === 'card') {
      const card = db.select().from(cards).where(eq(cards.id, id)).get();
      if (!card) return reply.code(404).send({ error: 'Not found' });
      if (card.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be purged' });
      await purgeCards(db, deps.dataDir, [card.id]);
      deps.emit.boardChanged(card.boardId, req.user.id);
      return reply.code(204).send();
    }

    if (entity === 'list') {
      const list = db.select().from(lists).where(eq(lists.id, id)).get();
      if (!list) return reply.code(404).send({ error: 'Not found' });
      if (list.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be purged' });
      const cardIds = db.select({ id: cards.id }).from(cards).where(eq(cards.listId, id)).all().map((c) => c.id);
      await purgeCards(db, deps.dataDir, cardIds);
      db.delete(lists).where(eq(lists.id, id)).run();
      deps.emit.boardChanged(list.boardId, req.user.id);
      return reply.code(204).send();
    }

    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board) return reply.code(404).send({ error: 'Not found' });
    if (board.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be purged' });
    const cardIds = db.select({ id: cards.id }).from(cards).where(eq(cards.boardId, id)).all().map((c) => c.id);
    await purgeCards(db, deps.dataDir, cardIds);
    db.delete(lists).where(eq(lists.boardId, id)).run();
    db.delete(labels).where(eq(labels.boardId, id)).run();
    db.delete(boardMembers).where(eq(boardMembers.boardId, id)).run();
    db.delete(activity).where(eq(activity.boardId, id)).run();
    db.delete(boards).where(eq(boards.id, id)).run();
    deps.emit.boardChanged(id, req.user.id);
    return reply.code(204).send();
  });

  app.get('/api/admin/archived-boards', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const rows = db.select().from(boards).where(isNotNull(boards.archivedAt)).all();
    const summaries: BoardSummary[] = rows.map((board) => {
      const cardCount = db.select().from(cards).where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt))).all().length;
      const memberCount = db.select().from(boardMembers).where(eq(boardMembers.boardId, board.id)).all().length;
      const membership = db.select().from(boardMembers).where(and(eq(boardMembers.boardId, board.id), eq(boardMembers.userId, req.user.id))).get();
      return {
        id: board.id,
        name: board.name,
        accentColor: board.accentColor as LabelColor,
        visibility: board.visibility,
        starred: membership?.starred ?? false,
        cardCount,
        memberCount,
        archivedAt: board.archivedAt,
      };
    });
    return reply.send(summaries);
  });

  app.post('/api/admin/restore', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const parsed = restoreSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const board = db.select().from(boards).where(eq(boards.id, parsed.data.id)).get();
    if (!board) return reply.code(404).send({ error: 'Not found' });
    if (board.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be restored' });
    db.update(boards).set({ archivedAt: null }).where(eq(boards.id, board.id)).run();
    deps.emit.boardChanged(board.id, req.user.id);
    return reply.code(204).send();
  });
}
