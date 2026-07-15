import { describe, it, expect } from 'vitest';
import type { BoardDetail, CardDto, ListDto } from '@shared/types';
import { positionBetween } from './position';
import { moveCard, moveList, sortByPosition } from './boardMoves';

const p1 = positionBetween(null, null);
const p2 = positionBetween(p1, null);
const p3 = positionBetween(p2, null);

function card(over: Partial<CardDto>): CardDto {
  return {
    id: 'c',
    listId: 'A',
    boardId: 'b',
    title: 'C',
    description: '',
    dueDate: null,
    position: p1,
    archivedAt: null,
    createdBy: 'u',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    assigneeIds: [],
    labelIds: [],
    checklist: [],
    attachmentCount: 0,
    commentCount: 0,
    ...over,
  };
}

function list(over: Partial<ListDto>): ListDto {
  return { id: 'A', boardId: 'b', name: 'A', position: p1, archivedAt: null, ...over };
}

function board(lists: ListDto[], cards: CardDto[]): BoardDetail {
  return {
    board: {
      id: 'b',
      name: 'B',
      accentColor: 'coral',
      visibility: 'team',
      starred: false,
      cardCount: cards.length,
      memberCount: 1,
      archivedAt: null,
      members: [],
    },
    lists,
    cards,
    labels: [],
  };
}

describe('sortByPosition', () => {
  it('orders by position then breaks ties by id', () => {
    const sorted = sortByPosition([
      { id: 'z', position: p1 },
      { id: 'a', position: p1 },
      { id: 'm', position: p2 },
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['a', 'z', 'm']);
  });
});

describe('moveCard', () => {
  const lists = [list({ id: 'A' }), list({ id: 'B', position: p2 })];

  it('moves a card into an empty list and reassigns its listId', () => {
    const cards = [card({ id: 'c1', listId: 'A', position: p1 })];
    const next = moveCard(board(lists, cards), { cardId: 'c1', toListId: 'B', toIndex: 0 });
    const moved = next.cards.find((c) => c.id === 'c1')!;
    expect(moved.listId).toBe('B');
    expect(next.cards.filter((c) => c.listId === 'B')).toHaveLength(1);
  });

  it('inserts between two cards with a position that sorts between them', () => {
    const cards = [
      card({ id: 'c1', listId: 'B', position: p1 }),
      card({ id: 'c2', listId: 'B', position: p2 }),
      card({ id: 'x', listId: 'A', position: p1 }),
    ];
    const next = moveCard(board(lists, cards), { cardId: 'x', toListId: 'B', toIndex: 1 });
    const moved = next.cards.find((c) => c.id === 'x')!;
    expect(moved.listId).toBe('B');
    expect(p1 < moved.position).toBe(true);
    expect(moved.position < p2).toBe(true);
  });

  it('ignores archived cards when computing destination neighbors', () => {
    const cards = [
      card({ id: 'c1', listId: 'B', position: p1 }),
      card({ id: 'gone', listId: 'B', position: p2, archivedAt: '2026-07-14T00:00:00.000Z' }),
      card({ id: 'x', listId: 'A', position: p3 }),
    ];
    const next = moveCard(board(lists, cards), { cardId: 'x', toListId: 'B', toIndex: 1 });
    const moved = next.cards.find((c) => c.id === 'x')!;
    expect(p1 < moved.position).toBe(true);
  });

  it('returns the same board object for an unknown card id', () => {
    const b = board(lists, [card({ id: 'c1' })]);
    expect(moveCard(b, { cardId: 'nope', toListId: 'B', toIndex: 0 })).toBe(b);
  });
});

describe('moveList', () => {
  it('reorders a list so it sorts between its new neighbors', () => {
    const lists = [
      list({ id: 'A', position: p1 }),
      list({ id: 'B', position: p2 }),
      list({ id: 'C', position: p3 }),
    ];
    const next = moveList(board(lists, []), { listId: 'C', toIndex: 1 });
    const moved = next.lists.find((l) => l.id === 'C')!;
    expect(p1 < moved.position).toBe(true);
    expect(moved.position < p2).toBe(true);
  });
});
