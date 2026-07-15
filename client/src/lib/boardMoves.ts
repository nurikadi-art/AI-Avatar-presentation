import type { BoardDetail, Id } from '@shared/types';
import { positionBetween } from './position';

export interface CardMove {
  cardId: Id;
  toListId: Id;
  toIndex: number;
}

export interface ListMove {
  listId: Id;
  toIndex: number;
}

export function sortByPosition<T extends { position: string; id: Id }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1,
  );
}

export function moveCard(board: BoardDetail, move: CardMove): BoardDetail {
  if (!board.cards.some((c) => c.id === move.cardId)) return board;
  const dest = sortByPosition(
    board.cards.filter(
      (c) => c.listId === move.toListId && c.id !== move.cardId && c.archivedAt === null,
    ),
  );
  const index = Math.max(0, Math.min(move.toIndex, dest.length));
  const prev = index > 0 ? dest[index - 1].position : null;
  const next = index < dest.length ? dest[index].position : null;
  const position = positionBetween(prev, next);
  return {
    ...board,
    cards: board.cards.map((c) =>
      c.id === move.cardId ? { ...c, listId: move.toListId, position } : c,
    ),
  };
}

export function moveList(board: BoardDetail, move: ListMove): BoardDetail {
  if (!board.lists.some((l) => l.id === move.listId)) return board;
  const dest = sortByPosition(
    board.lists.filter((l) => l.id !== move.listId && l.archivedAt === null),
  );
  const index = Math.max(0, Math.min(move.toIndex, dest.length));
  const prev = index > 0 ? dest[index - 1].position : null;
  const next = index < dest.length ? dest[index].position : null;
  const position = positionBetween(prev, next);
  return {
    ...board,
    lists: board.lists.map((l) => (l.id === move.listId ? { ...l, position } : l)),
  };
}
