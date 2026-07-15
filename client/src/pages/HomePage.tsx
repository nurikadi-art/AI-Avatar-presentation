import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { BoardSummary } from '@shared/types';
import { useBoards, useToggleStar } from '../api/queries';
import { groupBoards } from '../lib/groupBoards';
import { BoardTile, NewBoardTile } from '../components/BoardTile';
import { CreateBoardDialog } from '../components/CreateBoardDialog';
import { SearchResults } from '../components/SearchResults';

function BoardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-latte">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function HomePage() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  const boardsQuery = useBoards();
  const toggleStar = useToggleStar();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (q) return <SearchResults q={q} />;

  const boards = boardsQuery.data ?? [];
  const groups = groupBoards(boards);
  const open = (id: string) => navigate(`/b/${id}`);
  const star = (b: BoardSummary) => toggleStar.mutate({ boardId: b.id, starred: !b.starred });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {boardsQuery.isLoading && <p className="text-latte">Loading boards…</p>}

      {!boardsQuery.isLoading && boards.length === 0 && (
        <div className="rounded-lg border border-sand bg-paper p-10 text-center">
          <h2 className="text-xl font-semibold text-ink">No boards yet</h2>
          <p className="mt-2 text-latte">Create your first board to start organizing work.</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-6 rounded-md bg-coral px-4 py-2 font-medium text-paper hover:bg-rust"
          >
            Create your first board
          </button>
        </div>
      )}

      {!boardsQuery.isLoading && boards.length > 0 && (
        <>
          {groups.starred.length > 0 && (
            <BoardSection title="Starred">
              {groups.starred.map((b) => (
                <BoardTile key={b.id} board={b} onOpen={() => open(b.id)} onToggleStar={() => star(b)} />
              ))}
            </BoardSection>
          )}

          <BoardSection title="Team boards">
            <NewBoardTile onClick={() => setDialogOpen(true)} />
            {groups.team.map((b) => (
              <BoardTile key={b.id} board={b} onOpen={() => open(b.id)} onToggleStar={() => star(b)} />
            ))}
          </BoardSection>

          {groups.private.length > 0 && (
            <BoardSection title="Private boards">
              {groups.private.map((b) => (
                <BoardTile key={b.id} board={b} onOpen={() => open(b.id)} onToggleStar={() => star(b)} />
              ))}
            </BoardSection>
          )}
        </>
      )}

      <CreateBoardDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
