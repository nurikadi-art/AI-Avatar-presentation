import type { BoardSummary } from '@shared/types';

export interface BoardGroups {
  starred: BoardSummary[];
  team: BoardSummary[];
  private: BoardSummary[];
}

export function groupBoards(boards: BoardSummary[]): BoardGroups {
  const starred = boards.filter((b) => b.starred);
  const rest = boards.filter((b) => !b.starred);
  return {
    starred,
    team: rest.filter((b) => b.visibility === 'team'),
    private: rest.filter((b) => b.visibility === 'private'),
  };
}
