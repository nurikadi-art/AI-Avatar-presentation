import { LABEL_HEX, type BoardSummary } from '@shared/types';

export function BoardTile({
  board,
  onOpen,
  onToggleStar,
}: {
  board: BoardSummary;
  onOpen: () => void;
  onToggleStar: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-sand bg-paper transition hover:border-latte"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: LABEL_HEX[board.accentColor] }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-ink">{board.name}</h3>
          <button
            type="button"
            aria-label={board.starred ? 'Unstar board' : 'Star board'}
            aria-pressed={board.starred}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className="shrink-0 text-lg leading-none"
            style={{ color: board.starred ? LABEL_HEX.amber : '#B8865B' }}
          >
            {board.starred ? '★' : '☆'}
          </button>
        </div>
        <p className="mt-3 text-sm text-latte">
          {board.cardCount} {board.cardCount === 1 ? 'card' : 'cards'} · {board.memberCount}{' '}
          {board.memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
    </div>
  );
}

export function NewBoardTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[92px] items-center justify-center rounded-lg border border-dashed border-sand bg-paper/60 text-latte transition hover:border-coral hover:text-coral"
    >
      <span className="text-sm font-medium">+ New board</span>
    </button>
  );
}
