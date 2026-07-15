import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { ListDto } from '@shared/types';
import type { RouteCtx } from '../app';
import { boards, lists } from '../db/schema';
import { requireAuth, canAccessBoard } from '../lib/perms';
import { positionBetween } from '../lib/position';
import { logActivity } from '../lib/activity';

const createListSchema = z.object({ name: z.string().trim().min(1).max(200) });
const patchListSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    position: z.string().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

function toListDto(row: typeof lists.$inferSelect): ListDto {
  return { id: row.id, boardId: row.boardId, name: row.name, position: row.position, archivedAt: row.archivedAt };
}

export function registerListRoutes(app: FastifyInstance, ctx: RouteCtx) {
  const { db, emit } = ctx;

  app.post('/api/boards/:id/lists', { preHandler: requireAuth }, async (req, reply) => {
    const { id: boardId } = req.params as { id: string };
    const parsed = createListSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const board = db.select().from(boards).where(eq(boards.id, boardId)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, boardId)) return reply.code(403).send({ error: 'forbidden' });

    const last = db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
      .orderBy(desc(lists.position), desc(lists.id))
      .limit(1)
      .get();
    const row = {
      id: nanoid(12),
      boardId,
      name: parsed.data.name,
      position: positionBetween(last?.position ?? null, null),
      archivedAt: null as string | null,
    };
    db.insert(lists).values(row).run();
    logActivity(db, { boardId, actorId: req.user.id, type: 'list.created', data: { listId: row.id, name: row.name } });
    emit.boardChanged(boardId, req.user.id);
    return reply.code(201).send(toListDto(row));
  });

  app.patch('/api/lists/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchListSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const list = db.select().from(lists).where(eq(lists.id, id)).get();
    if (!list) return reply.code(404).send({ error: 'list not found' });
    if (!canAccessBoard(db, req.user.id, list.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof lists.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.position !== undefined) patch.position = parsed.data.position;
    db.update(lists).set(patch).where(eq(lists.id, id)).run();

    const type = parsed.data.name !== undefined ? 'list.renamed' : 'list.moved';
    logActivity(db, { boardId: list.boardId, actorId: req.user.id, type, data: { listId: id } });
    emit.boardChanged(list.boardId, req.user.id);
    const updated = db.select().from(lists).where(eq(lists.id, id)).get()!;
    return reply.send(toListDto(updated));
  });

  app.delete('/api/lists/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const list = db.select().from(lists).where(eq(lists.id, id)).get();
    if (!list) return reply.code(404).send({ error: 'list not found' });
    if (!canAccessBoard(db, req.user.id, list.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.update(lists).set({ archivedAt: new Date().toISOString() }).where(eq(lists.id, id)).run();
    logActivity(db, { boardId: list.boardId, actorId: req.user.id, type: 'list.archived', data: { listId: id, name: list.name } });
    emit.boardChanged(list.boardId, req.user.id);
    return reply.code(204).send();
  });
}
