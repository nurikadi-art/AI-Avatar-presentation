import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, inArray } from 'drizzle-orm';
import { requireAuth, canAccessBoard } from '../lib/perms';
import { comments, cards, cardAssignees, users } from '../db/schema';
import { notify } from '../lib/notify';
import type { AppDeps } from '../app';
import type { CommentDto } from '@shared/types';

const bodySchema = z.object({ body: z.string().trim().min(1).max(10000) });

const MENTION_RE = /@\[([A-Za-z0-9_-]+)\]/g;

export function parseMentions(body: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  return ids;
}

export function registerCommentRoutes(app: FastifyInstance, { db, emit }: AppDeps): void {
  app.post('/api/cards/:id/comments', { preHandler: requireAuth }, async (req, reply) => {
    const cardId = (req.params as { id: string }).id;
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid comment' });

    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) return reply.code(404).send({ error: 'Card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const authorId = req.user.id;
    const now = new Date().toISOString();
    const id = nanoid(12);
    db.insert(comments)
      .values({ id, cardId, authorId, body: parsed.data.body, createdAt: now })
      .run();

    const notified = new Set<string>([authorId]);

    const mentionIds = parseMentions(parsed.data.body);
    if (mentionIds.length) {
      const realIds = new Set(
        db.select({ id: users.id }).from(users).where(inArray(users.id, mentionIds)).all().map((u) => u.id),
      );
      for (const uid of mentionIds) {
        if (realIds.has(uid) && !notified.has(uid)) {
          notify(db, { userId: uid, type: 'mentioned', cardId, actorId: authorId });
          notified.add(uid);
        }
      }
    }

    const assigneeIds = db
      .select({ userId: cardAssignees.userId })
      .from(cardAssignees)
      .where(eq(cardAssignees.cardId, cardId))
      .all()
      .map((a) => a.userId);
    for (const uid of [card.createdBy, ...assigneeIds]) {
      if (!notified.has(uid)) {
        notify(db, { userId: uid, type: 'comment_on_your_card', cardId, actorId: authorId });
        notified.add(uid);
      }
    }

    emit.boardChanged(card.boardId, authorId);

    const dto: CommentDto = { id, cardId, authorId, body: parsed.data.body, createdAt: now };
    return reply.code(201).send(dto);
  });
}
