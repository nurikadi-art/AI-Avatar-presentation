import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, inArray, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { requireAuth } from '../lib/perms';
import { notifications, cards, users } from '../db/schema';
import type { AppDeps } from '../app';
import type { NotificationDto } from '@shared/types';

const readSchema = z.object({ ids: z.array(z.string()).optional() });

export function registerNotificationRoutes(app: FastifyInstance, { db }: AppDeps): void {
  const actor = alias(users, 'actor');

  app.get('/api/notifications', { preHandler: requireAuth }, async (req, reply) => {
    const rows = db
      .select({
        id: notifications.id,
        type: notifications.type,
        cardId: notifications.cardId,
        cardTitle: cards.title,
        boardId: cards.boardId,
        actorId: notifications.actorId,
        actorName: actor.name,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .innerJoin(cards, eq(cards.id, notifications.cardId))
      .leftJoin(actor, eq(actor.id, notifications.actorId))
      .where(eq(notifications.userId, req.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
      .all();
    return reply.send(rows as NotificationDto[]);
  });

  app.post('/api/notifications/read', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = readSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const now = new Date().toISOString();
    const ids = parsed.data.ids;
    if (ids && ids.length) {
      db.update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, req.user.id), inArray(notifications.id, ids), isNull(notifications.readAt)))
        .run();
    } else {
      db.update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)))
        .run();
    }
    return reply.code(204).send();
  });
}
