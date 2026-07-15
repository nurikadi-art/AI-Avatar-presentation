import { describe, it, expect } from 'vitest';
import { groupBoards } from './groupBoards';
import type { BoardSummary } from '@shared/types';

function board(over: Partial<BoardSummary>): BoardSummary {
  return {
    id: 'b',
    name: 'B',
    accentColor: 'coral',
    visibility: 'team',
    starred: false,
    cardCount: 0,
    memberCount: 1,
    archivedAt: null,
    ...over,
  };
}

describe('groupBoards', () => {
  it('partitions into starred, team, and private without duplicating starred boards', () => {
    const groups = groupBoards([
      board({ id: 's1', name: 'Starred team', visibility: 'team', starred: true }),
      board({ id: 't1', name: 'Team one', visibility: 'team', starred: false }),
      board({ id: 'p1', name: 'Private one', visibility: 'private', starred: false }),
      board({ id: 'sp', name: 'Starred private', visibility: 'private', starred: true }),
    ]);
    expect(groups.starred.map((b) => b.id)).toEqual(['s1', 'sp']);
    expect(groups.team.map((b) => b.id)).toEqual(['t1']);
    expect(groups.private.map((b) => b.id)).toEqual(['p1']);
  });

  it('returns empty groups for no boards', () => {
    expect(groupBoards([])).toEqual({ starred: [], team: [], private: [] });
  });
});
