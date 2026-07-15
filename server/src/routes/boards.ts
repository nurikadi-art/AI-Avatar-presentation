import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { BoardDetail, BoardSummary, CardDto, ChecklistItemDto, Label, LabelColor, ListDto, UserPublic } from '@shared/types';
import type { RouteCtx } from '../app';
import { attachments, boardMembers, boards, cardAssignees, cardLabels, cards, checklistItems, comments, labels, lists, users } from '../db/schema';
import { canAccessBoard, requireAuth, toUserPublic } from '../lib/perms';
import { logActivity } from '../lib/activity';

type Db = RouteCtx['db'];

const labelColorSchema = z.enum(['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray']);

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  visibility: z.enum(['team', 'private']),
  accentColor: labelColorSchema,
});

function toLabel(row: typeof labels.$inferSelect): Label {
  return { id: row.id, boardId: row.boardId, name: row.name, color: row.color as LabelColor };
}

function boardMembersList(db: Db, boardId: string): UserPublic[] {
  return db
    .select()
    .from(boardMembers)
    .where(eq(boardMembers.boardId, boardId))
    .all()
    .map((m) => db.select().from(users).where(eq(users.id, m.userId)).get())
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map(toUserPublic);
}

function cardToDto(db: Db, card: typeof cards.$inferSelect): CardDto {
  const assigneeIds = db.select().from(cardAssignees).where(eq(cardAssignees.cardId, card.id)).all().map((r) => r.userId);
  const labelIds = db.select().from(cardLabels).where(eq(cardLabels.cardId, card.id)).all().map((r) => r.labelId);
  const checklist: ChecklistItemDto[] = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, card.id))
    .orderBy(asc(checklistItems.position), asc(checklistItems.id))
    .all()
    .map((r) => ({ id: r.id, cardId: r.cardId, text: r.text, done: r.done, position: r.position }));
  const attachmentCount = db.select().from(attachments).where(eq(attachments.cardId, card.id)).all().length;
  const commentCount = db.select().from(comments).where(eq(comments.cardId, card.id)).all().length;
  return {
    id: card.id,
    listId: card.listId,
    boardId: card.boardId,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate,
    position: card.position,
    archivedAt: card.archivedAt,
    createdBy: card.createdBy,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    assigneeIds,
    labelIds,
    checklist,
    attachmentCount,
    commentCount,
  };
}

function boardSummary(db: Db, board: typeof boards.$inferSelect, userId: string): BoardSummary {
  const membership = db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, board.id), eq(boardMembers.userId, userId)))
    .get();
  const cardCount = db.select().from(cards).where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt))).all().length;
  const memberCount = db.select().from(boardMembers).where(eq(boardMembers.boardId, board.id)).all().length;
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
}

function buildBoardDetail(db: Db, board: typeof boards.$inferSelect, userId: string): BoardDetail {
  const summary = boardSummary(db, board, userId);
  const members = boardMembersList(db, board.id);
  const boardLists: ListDto[] = db
    .select()
    .from(lists)
    .where(and(eq(lists.boardId, board.id), isNull(lists.archivedAt)))
    .orderBy(asc(lists.position), asc(lists.id))
    .all()
    .map((l) => ({ id: l.id, boardId: l.boardId, name: l.name, position: l.position, archivedAt: l.archivedAt }));
  const boardCards: CardDto[] = db
    .select()
    .from(cards)
    .where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.id))
    .all()
    .map((c) => cardToDto(db, c));
  const boardLabels: Label[] = db.select().from(labels).where(eq(labels.boardId, board.id)).all().map(toLabel);
  return { board: { ...summary, members }, lists: boardLists, cards: boardCards, labels: boardLabels };
}

export function registerBoardRoutes(app: FastifyInstance, ctx: RouteCtx) {
  const { db, emit } = ctx;

  app.post('/api/boards', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const now = new Date().toISOString();
    const boardId = nanoid(12);
    db.insert(boards).values({
      id: boardId,
      name: parsed.data.name,
      accentColor: parsed.data.accentColor,
      visibility: parsed.data.visibility,
      createdBy: req.user.id,
      archivedAt: null,
      createdAt: now,
    }).run();
    db.insert(boardMembers).values({ boardId, userId: req.user.id, starred: false }).run();
    for (const color of labelColorSchema.options) {
      db.insert(labels).values({ id: nanoid(12), boardId, name: '', color }).run();
    }
    logActivity(db, { boardId, actorId: req.user.id, type: 'board.created', data: { name: parsed.data.name } });
    emit.boardChanged(boardId, req.user.id);
    const board = db.select().from(boards).where(eq(boards.id, boardId)).get()!;
    return reply.code(201).send(buildBoardDetail(db, board, req.user.id));
  });

  app.get('/api/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });
    return reply.send(buildBoardDetail(db, board, req.user.id));
  });

  app.get('/api/boards', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.user.id;
    const visible = db
      .select()
      .from(boards)
      .where(isNull(boards.archivedAt))
      .all()
      .filter((b) => {
        if (b.visibility === 'team') return true;
        return !!db
          .select()
          .from(boardMembers)
          .where(and(eq(boardMembers.boardId, b.id), eq(boardMembers.userId, userId)))
          .get();
      });
    return reply.send(visible.map((b) => boardSummary(db, b, userId)));
  });

  const patchBoardSchema = z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      visibility: z.enum(['team', 'private']).optional(),
      accentColor: labelColorSchema.optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.patch('/api/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchBoardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof boards.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility;
    if (parsed.data.accentColor !== undefined) patch.accentColor = parsed.data.accentColor;
    db.update(boards).set(patch).where(eq(boards.id, id)).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.updated', data: parsed.data });
    emit.boardChanged(id, req.user.id);
    const updated = db.select().from(boards).where(eq(boards.id, id)).get()!;
    return reply.send(boardSummary(db, updated, req.user.id));
  });

  app.delete('/api/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });
    db.update(boards).set({ archivedAt: new Date().toISOString() }).where(eq(boards.id, id)).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.archived', data: { name: board.name } });
    emit.boardChanged(id, req.user.id);
    return reply.code(204).send();
  });

  const starSchema = z.object({ starred: z.boolean() });

  app.post('/api/boards/:id/star', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = starSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    db.insert(boardMembers)
      .values({ boardId: id, userId: req.user.id, starred: parsed.data.starred })
      .onConflictDoUpdate({ target: [boardMembers.boardId, boardMembers.userId], set: { starred: parsed.data.starred } })
      .run();
    emit.boardChanged(id, req.user.id);
    return reply.send(boardSummary(db, board, req.user.id));
  });

  const addMemberSchema = z.object({ userId: z.string().min(1) });

  app.post('/api/boards/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });
    const target = db.select().from(users).where(eq(users.id, parsed.data.userId)).get();
    if (!target || target.deactivatedAt !== null) return reply.code(400).send({ error: 'user not found' });

    db.insert(boardMembers).values({ boardId: id, userId: target.id, starred: false }).onConflictDoNothing().run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.member_added', data: { userId: target.id } });
    emit.boardChanged(id, req.user.id);
    return reply.send(boardMembersList(db, id));
  });

  app.delete('/api/boards/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(boardMembers).where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, userId))).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.member_removed', data: { userId } });
    emit.boardChanged(id, req.user.id);
    return reply.send(boardMembersList(db, id));
  });

  const createLabelSchema = z.object({ name: z.string().trim().max(50).optional(), color: labelColorSchema });
  const patchLabelSchema = z
    .object({ name: z.string().trim().max(50).optional(), color: labelColorSchema.optional() })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.post('/api/boards/:id/labels', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    const labelId = nanoid(12);
    db.insert(labels).values({ id: labelId, boardId: id, name: parsed.data.name ?? '', color: parsed.data.color }).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'label.created', data: { labelId } });
    emit.boardChanged(id, req.user.id);
    return reply.code(201).send(toLabel(db.select().from(labels).where(eq(labels.id, labelId)).get()!));
  });

  app.patch('/api/labels/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchLabelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const label = db.select().from(labels).where(eq(labels.id, id)).get();
    if (!label) return reply.code(404).send({ error: 'label not found' });
    if (!canAccessBoard(db, req.user.id, label.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof labels.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.color !== undefined) patch.color = parsed.data.color;
    db.update(labels).set(patch).where(eq(labels.id, id)).run();
    logActivity(db, { boardId: label.boardId, actorId: req.user.id, type: 'label.updated', data: { labelId: id } });
    emit.boardChanged(label.boardId, req.user.id);
    return reply.send(toLabel(db.select().from(labels).where(eq(labels.id, id)).get()!));
  });

  app.delete('/api/labels/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const label = db.select().from(labels).where(eq(labels.id, id)).get();
    if (!label) return reply.code(404).send({ error: 'label not found' });
    if (!canAccessBoard(db, req.user.id, label.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(cardLabels).where(eq(cardLabels.labelId, id)).run();
    db.delete(labels).where(eq(labels.id, id)).run();
    logActivity(db, { boardId: label.boardId, actorId: req.user.id, type: 'label.deleted', data: { labelId: id } });
    emit.boardChanged(label.boardId, req.user.id);
    return reply.code(204).send();
  });

  app.get('/api/boards/:id/archived', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    const archivedLists: ListDto[] = db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, id), isNotNull(lists.archivedAt)))
      .orderBy(asc(lists.position), asc(lists.id))
      .all()
      .map((l) => ({ id: l.id, boardId: l.boardId, name: l.name, position: l.position, archivedAt: l.archivedAt }));
    const archivedCards: CardDto[] = db
      .select()
      .from(cards)
      .where(and(eq(cards.boardId, id), isNotNull(cards.archivedAt)))
      .orderBy(asc(cards.position), asc(cards.id))
      .all()
      .map((c) => cardToDto(db, c));
    return reply.send({ lists: archivedLists, cards: archivedCards });
  });

  const restoreSchema = z.object({ entity: z.enum(['list', 'card']), id: z.string().min(1) });

  app.post('/api/boards/:id/restore', { preHandler: requireAuth }, async (req, reply) => {
    const { id: boardId } = req.params as { id: string };
    const parsed = restoreSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, boardId)).get();
    if (!board) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, boardId)) return reply.code(403).send({ error: 'forbidden' });

    if (parsed.data.entity === 'list') {
      const list = db.select().from(lists).where(eq(lists.id, parsed.data.id)).get();
      if (!list || list.boardId !== boardId) return reply.code(404).send({ error: 'list not found' });
      db.update(lists).set({ archivedAt: null }).where(eq(lists.id, list.id)).run();
    } else {
      const card = db.select().from(cards).where(eq(cards.id, parsed.data.id)).get();
      if (!card || card.boardId !== boardId) return reply.code(404).send({ error: 'card not found' });
      db.update(cards).set({ archivedAt: null }).where(eq(cards.id, card.id)).run();
    }
    logActivity(db, { boardId, actorId: req.user.id, type: 'board.restored', data: { entity: parsed.data.entity, id: parsed.data.id } });
    emit.boardChanged(boardId, req.user.id);
    return reply.send(buildBoardDetail(db, board, req.user.id));
  });

  // BOARD_ROUTES_APPEND
}
