import type { FastifyInstance } from 'fastify';
import { and, or, eq, like, isNull, inArray, desc } from 'drizzle-orm';
import { requireAuth } from '../lib/perms';
import { boards, boardMembers, lists, cards } from '../db/schema';
import type { Db } from '../db/index';
import type { AppDeps } from '../app';
import type { Me, SearchResult } from '@shared/types';

function accessibleBoardIds(db: Db, user: Me): string[] {
  const all = db
    .select({ id: boards.id, visibility: boards.visibility })
    .from(boards)
    .where(isNull(boards.archivedAt))
    .all();
  if (user.isAdmin) return all.map((b) => b.id);
  const memberOf = new Set(
    db.select({ boardId: boardMembers.boardId }).from(boardMembers).where(eq(boardMembers.userId, user.id)).all().map((r) => r.boardId),
  );
  return all.filter((b) => b.visibility === 'team' || memberOf.has(b.id)).map((b) => b.id);
}

export function registerSearchRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get('/api/search', { preHandler: requireAuth }, async (req, reply) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    if (!q) return reply.send([]);

    const boardIds = accessibleBoardIds(db, req.user);
    if (boardIds.length === 0) return reply.send([]);

    const pattern = `%${q}%`;
    const rows = db
      .select({
        cardId: cards.id,
        boardId: cards.boardId,
        title: cards.title,
        boardName: boards.name,
        listName: lists.name,
      })
      .from(cards)
      .innerJoin(boards, eq(boards.id, cards.boardId))
      .innerJoin(lists, eq(lists.id, cards.listId))
      .where(
        and(
          inArray(cards.boardId, boardIds),
          isNull(cards.archivedAt),
          isNull(lists.archivedAt),
          or(like(cards.title, pattern), like(cards.description, pattern)),
        ),
      )
      .orderBy(desc(cards.updatedAt))
      .limit(20)
      .all();

    return reply.send(rows satisfies SearchResult[]);
  });
}
