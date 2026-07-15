import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export function logActivity(
  db: Db,
  entry: { boardId: string; cardId?: string | null; actorId: string; type: string; data: Record<string, unknown> },
): void {
  db.insert(schema.activity)
    .values({
      id: nanoid(12),
      boardId: entry.boardId,
      cardId: entry.cardId ?? null,
      actorId: entry.actorId,
      type: entry.type,
      data: JSON.stringify(entry.data),
      createdAt: new Date().toISOString(),
    })
    .run();
}
