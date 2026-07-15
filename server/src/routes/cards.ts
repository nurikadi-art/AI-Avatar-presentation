import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { ActivityDto, AttachmentDto, CardDto, ChecklistItemDto, CommentDto } from '@shared/types';
import type { RouteCtx } from '../app';
import { activity, attachments, cardAssignees, cardLabels, cards, checklistItems, comments, labels, lists } from '../db/schema';
import { requireAuth, canAccessBoard } from '../lib/perms';
import { positionBetween } from '../lib/position';
import { logActivity } from '../lib/activity';
import { notify } from '../lib/notify';

type Db = RouteCtx['db'];

const createCardSchema = z.object({ title: z.string().trim().min(1).max(500) });

function loadCardDto(db: Db, cardId: string): CardDto | undefined {
  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card) return undefined;
  const assigneeIds = db.select().from(cardAssignees).where(eq(cardAssignees.cardId, cardId)).all().map((r) => r.userId);
  const labelIds = db.select().from(cardLabels).where(eq(cardLabels.cardId, cardId)).all().map((r) => r.labelId);
  const checklist: ChecklistItemDto[] = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, cardId))
    .orderBy(asc(checklistItems.position), asc(checklistItems.id))
    .all()
    .map((r) => ({ id: r.id, cardId: r.cardId, text: r.text, done: r.done, position: r.position }));
  const attachmentCount = db.select().from(attachments).where(eq(attachments.cardId, cardId)).all().length;
  const commentCount = db.select().from(comments).where(eq(comments.cardId, cardId)).all().length;
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

export function registerCardRoutes(app: FastifyInstance, ctx: RouteCtx) {
  const { db, emit } = ctx;

  app.post('/api/lists/:id/cards', { preHandler: requireAuth }, async (req, reply) => {
    const { id: listId } = req.params as { id: string };
    const parsed = createCardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const list = db.select().from(lists).where(eq(lists.id, listId)).get();
    if (!list || list.archivedAt) return reply.code(404).send({ error: 'list not found' });
    if (!canAccessBoard(db, req.user.id, list.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const last = db
      .select()
      .from(cards)
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
      .orderBy(desc(cards.position), desc(cards.id))
      .limit(1)
      .get();
    const now = new Date().toISOString();
    const id = nanoid(12);
    db.insert(cards)
      .values({
        id,
        listId,
        boardId: list.boardId,
        title: parsed.data.title,
        description: '',
        dueDate: null,
        position: positionBetween(last?.position ?? null, null),
        archivedAt: null,
        createdBy: req.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    logActivity(db, { boardId: list.boardId, cardId: id, actorId: req.user.id, type: 'card.created', data: { title: parsed.data.title } });
    emit.boardChanged(list.boardId, req.user.id);
    return reply.code(201).send(loadCardDto(db, id)!);
  });

  app.get('/api/cards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const dto = loadCardDto(db, id)!;
    const cardComments: CommentDto[] = db
      .select()
      .from(comments)
      .where(eq(comments.cardId, id))
      .orderBy(asc(comments.createdAt), asc(comments.id))
      .all()
      .map((r) => ({ id: r.id, cardId: r.cardId, authorId: r.authorId, body: r.body, createdAt: r.createdAt }));
    const cardAttachments: AttachmentDto[] = db
      .select()
      .from(attachments)
      .where(eq(attachments.cardId, id))
      .orderBy(asc(attachments.createdAt), asc(attachments.id))
      .all()
      .map((r) => ({ id: r.id, cardId: r.cardId, filename: r.filename, sizeBytes: r.sizeBytes, mime: r.mime, uploadedBy: r.uploadedBy, createdAt: r.createdAt }));
    const cardActivity: ActivityDto[] = db
      .select()
      .from(activity)
      .where(eq(activity.cardId, id))
      .orderBy(desc(activity.createdAt), desc(activity.id))
      .all()
      .map((r) => ({ id: r.id, boardId: r.boardId, cardId: r.cardId, actorId: r.actorId, type: r.type, data: JSON.parse(r.data) as Record<string, unknown>, createdAt: r.createdAt }));

    return reply.send({ ...dto, comments: cardComments, attachments: cardAttachments, activity: cardActivity });
  });

  const dueDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
    .refine((s) => {
      const d = new Date(`${s}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, 'invalid calendar date');
  const patchCardSchema = z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      description: z.string().max(20000).optional(),
      dueDate: z.union([dueDateSchema, z.null()]).optional(),
      listId: z.string().min(1).optional(),
      position: z.string().min(1).optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.patch('/api/cards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchCardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const { title, description, dueDate, listId, position } = parsed.data;

    if (listId !== undefined) {
      const target = db.select().from(lists).where(eq(lists.id, listId)).get();
      if (!target || target.archivedAt) return reply.code(404).send({ error: 'target list not found' });
      if (target.boardId !== card.boardId) return reply.code(400).send({ error: 'list belongs to another board' });
    }

    const patch: Partial<typeof cards.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (dueDate !== undefined) patch.dueDate = dueDate;
    if (listId !== undefined) patch.listId = listId;
    if (position !== undefined) patch.position = position;
    db.update(cards).set(patch).where(eq(cards.id, id)).run();

    if (title !== undefined && title !== card.title)
      logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.renamed', data: { title } });
    if (description !== undefined && description !== card.description)
      logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.description_updated', data: {} });
    if (dueDate !== undefined && dueDate !== card.dueDate)
      logActivity(db, {
        boardId: card.boardId,
        cardId: id,
        actorId: req.user.id,
        type: dueDate === null ? 'card.due_date_cleared' : 'card.due_date_set',
        data: dueDate === null ? {} : { dueDate },
      });
    if (position !== undefined || (listId !== undefined && listId !== card.listId))
      logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.moved', data: { fromListId: card.listId, toListId: listId ?? card.listId } });

    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  app.delete('/api/cards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const now = new Date().toISOString();
    db.update(cards).set({ archivedAt: now, updatedAt: now }).where(eq(cards.id, id)).run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.archived', data: { title: card.title } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.code(204).send();
  });

  const assigneeBodySchema = z.object({ userId: z.string().min(1) });

  app.post('/api/cards/:id/assignees', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = assigneeBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });
    const { userId } = parsed.data;
    if (!canAccessBoard(db, userId, card.boardId)) return reply.code(400).send({ error: 'user has no access to this board' });

    db.insert(cardAssignees).values({ cardId: id, userId }).onConflictDoNothing().run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.assignee_added', data: { userId } });
    if (userId !== req.user.id) notify(db, { userId, type: 'assigned', cardId: id, actorId: req.user.id });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  app.delete('/api/cards/:id/assignees/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(cardAssignees).where(and(eq(cardAssignees.cardId, id), eq(cardAssignees.userId, userId))).run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.assignee_removed', data: { userId } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  const labelBodySchema = z.object({ labelId: z.string().min(1) });

  app.post('/api/cards/:id/labels', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = labelBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });
    const label = db.select().from(labels).where(eq(labels.id, parsed.data.labelId)).get();
    if (!label || label.boardId !== card.boardId) return reply.code(400).send({ error: 'label belongs to another board' });

    db.insert(cardLabels).values({ cardId: id, labelId: label.id }).onConflictDoNothing().run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.label_added', data: { labelId: label.id } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  app.delete('/api/cards/:id/labels/:labelId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, labelId } = req.params as { id: string; labelId: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(cardLabels).where(and(eq(cardLabels.cardId, id), eq(cardLabels.labelId, labelId))).run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.label_removed', data: { labelId } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  const addChecklistSchema = z.object({ text: z.string().trim().min(1).max(1000) });
  const patchChecklistSchema = z
    .object({
      text: z.string().trim().min(1).max(1000).optional(),
      done: z.boolean().optional(),
      position: z.string().min(1).optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.post('/api/cards/:id/checklist', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = addChecklistSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const last = db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.cardId, id))
      .orderBy(desc(checklistItems.position), desc(checklistItems.id))
      .limit(1)
      .get();
    const itemId = nanoid(12);
    db.insert(checklistItems)
      .values({ id: itemId, cardId: id, text: parsed.data.text, done: false, position: positionBetween(last?.position ?? null, null) })
      .run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.checklist_item_added', data: { itemId, text: parsed.data.text } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.code(201).send(loadCardDto(db, id)!);
  });

  app.patch('/api/checklist/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchChecklistSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
    if (!item) return reply.code(404).send({ error: 'checklist item not found' });
    const card = db.select().from(cards).where(eq(cards.id, item.cardId)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof checklistItems.$inferInsert> = {};
    if (parsed.data.text !== undefined) patch.text = parsed.data.text;
    if (parsed.data.done !== undefined) patch.done = parsed.data.done;
    if (parsed.data.position !== undefined) patch.position = parsed.data.position;
    db.update(checklistItems).set(patch).where(eq(checklistItems.id, id)).run();

    if (parsed.data.done !== undefined)
      logActivity(db, { boardId: card.boardId, cardId: card.id, actorId: req.user.id, type: 'card.checklist_item_toggled', data: { itemId: id, done: parsed.data.done } });
    else if (parsed.data.text !== undefined)
      logActivity(db, { boardId: card.boardId, cardId: card.id, actorId: req.user.id, type: 'card.checklist_item_edited', data: { itemId: id } });

    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, card.id)!);
  });

  app.delete('/api/checklist/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
    if (!item) return reply.code(404).send({ error: 'checklist item not found' });
    const card = db.select().from(cards).where(eq(cards.id, item.cardId)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(checklistItems).where(eq(checklistItems.id, id)).run();
    logActivity(db, { boardId: card.boardId, cardId: card.id, actorId: req.user.id, type: 'card.checklist_item_deleted', data: { itemId: id } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, card.id)!);
  });

  // CARD_ROUTES_APPEND
}
