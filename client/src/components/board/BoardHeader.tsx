import { useState } from 'react';
import { Link } from 'react-router';
import { LABEL_HEX, type BoardSummary, type UserPublic, type Id } from '@shared/types';
import { Avatar } from '../ui/Avatar';
import { BoardMenu } from './BoardMenu';
import { usePatchBoard, useSetBoardStar } from '../../api/queries';

export function BoardHeader({
  boardId,
  board,
  members,
  presentIds,
  isAdmin,
  disabled,
}: {
  boardId: Id;
  board: BoardSummary;
  members: UserPublic[];
  presentIds: Set<Id>;
  isAdmin: boolean;
  disabled: boolean;
}) {
  const patchBoard = usePatchBoard(boardId);
  const setStar = useSetBoardStar(boardId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(board.name);

  const commit = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== board.name) patchBoard.mutate({ name: trimmed });
    else setName(board.name);
  };

  return (
    <div className="flex items-center gap-3 border-b border-sand bg-paper px-4 py-3">
      <Link to="/" className="text-latte hover:text-rust" aria-label="Back to boards">
        ←
      </Link>
      <span
        className="h-4 w-1.5 rounded-full"
        style={{ backgroundColor: LABEL_HEX[board.accentColor] }}
      />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setName(board.name);
              setEditing(false);
            }
          }}
          className="rounded border border-sand bg-paper px-2 py-1 text-lg font-semibold text-ink outline-none focus:border-coral"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setName(board.name);
            setEditing(true);
          }}
          className="text-lg font-semibold text-ink"
        >
          {board.name}
        </button>
      )}
      <button
        type="button"
        aria-label={board.starred ? 'Unstar board' : 'Star board'}
        aria-pressed={board.starred}
        disabled={disabled}
        onClick={() => setStar.mutate(!board.starred)}
        className="text-lg leading-none disabled:opacity-40"
        style={{ color: board.starred ? LABEL_HEX.amber : '#B8865B' }}
      >
        {board.starred ? '★' : '☆'}
      </button>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex -space-x-1.5">
          {members.map((m) => (
            <span
              key={m.id}
              className={`inline-flex rounded-full ${
                presentIds.has(m.id) ? 'ring-2 ring-coral' : ''
              }`}
              title={presentIds.has(m.id) ? `${m.name} (viewing)` : m.name}
            >
              <Avatar name={m.name} color={m.avatarColor} size={28} />
            </span>
          ))}
        </div>
        <BoardMenu boardId={boardId} board={board} members={members} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
