import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { BoardSummary, UserPublic, Id } from '@shared/types';
import { Menu, type MenuItem } from '../ui/Menu';
import { Dialog } from '../ui/Dialog';
import { Avatar } from '../ui/Avatar';
import {
  usePatchBoard,
  useArchiveBoard,
  useAddBoardMember,
  useRemoveBoardMember,
  useDirectory,
  useArchivedItems,
  useRestoreArchived,
} from '../../api/queries';

export function BoardMenu({
  boardId,
  board,
  members,
  isAdmin,
}: {
  boardId: Id;
  board: BoardSummary;
  members: UserPublic[];
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const patchBoard = usePatchBoard(boardId);
  const archiveBoard = useArchiveBoard(boardId);
  const [membersOpen, setMembersOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const items: MenuItem[] = [
    {
      label: board.visibility === 'team' ? 'Make private' : 'Make team',
      onSelect: () =>
        patchBoard.mutate({ visibility: board.visibility === 'team' ? 'private' : 'team' }),
    },
    ...(isAdmin ? [{ label: 'Members…', onSelect: () => setMembersOpen(true) }] : []),
    { label: 'Archived items…', onSelect: () => setArchivedOpen(true) },
    {
      label: 'Archive board',
      danger: true,
      onSelect: () => {
        if (window.confirm('Archive this board? You can restore it from Admin.')) {
          archiveBoard.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) });
        }
      },
    },
  ];

  return (
    <>
      <Menu
        trigger={
          <span className="rounded-md px-2 py-1 text-lg leading-none text-latte hover:text-rust">
            ⋯
          </span>
        }
        items={items}
      />
      {membersOpen && (
        <MembersDialog boardId={boardId} members={members} onClose={() => setMembersOpen(false)} />
      )}
      {archivedOpen && <ArchivedDialog boardId={boardId} onClose={() => setArchivedOpen(false)} />}
    </>
  );
}

function MembersDialog({
  boardId,
  members,
  onClose,
}: {
  boardId: Id;
  members: UserPublic[];
  onClose: () => void;
}) {
  const directory = useDirectory();
  const addMember = useAddBoardMember(boardId);
  const removeMember = useRemoveBoardMember(boardId);
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (directory.data ?? []).filter((u) => !memberIds.has(u.id) && !u.deactivated);

  return (
    <Dialog open onClose={onClose} title="Board members">
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <Avatar name={m.name} color={m.avatarColor} size={24} />
            <span className="flex-1 text-sm text-ink">{m.name}</span>
            <button
              type="button"
              onClick={() => removeMember.mutate(m.id)}
              className="text-xs text-red-700 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-sand pt-4">
        <p className="mb-2 text-sm font-medium text-rust">Add member</p>
        {directory.isLoading && <p className="text-sm text-latte">Loading…</p>}
        <ul className="flex flex-col gap-2">
          {candidates.map((u) => (
            <li key={u.id} className="flex items-center gap-2">
              <Avatar name={u.name} color={u.avatarColor} size={24} />
              <span className="flex-1 text-sm text-ink">{u.name}</span>
              <button
                type="button"
                onClick={() => addMember.mutate(u.id)}
                className="text-xs text-coral hover:underline"
              >
                Add
              </button>
            </li>
          ))}
          {!directory.isLoading && candidates.length === 0 && (
            <li className="text-sm text-latte">Everyone is already a member.</li>
          )}
        </ul>
      </div>
    </Dialog>
  );
}

function ArchivedDialog({ boardId, onClose }: { boardId: Id; onClose: () => void }) {
  const archived = useArchivedItems(boardId, true);
  const restore = useRestoreArchived(boardId);
  const lists = archived.data?.lists ?? [];
  const cards = archived.data?.cards ?? [];

  return (
    <Dialog open onClose={onClose} title="Archived items">
      {archived.isLoading && <p className="text-sm text-latte">Loading…</p>}
      {!archived.isLoading && lists.length === 0 && cards.length === 0 && (
        <p className="text-sm text-latte">Nothing archived.</p>
      )}
      {lists.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-rust">Lists</p>
          <ul className="flex flex-col gap-2">
            {lists.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-ink">{l.name || 'Untitled'}</span>
                <button
                  type="button"
                  onClick={() => restore.mutate({ entity: 'list', id: l.id })}
                  className="text-xs text-coral hover:underline"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {cards.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-rust">Cards</p>
          <ul className="flex flex-col gap-2">
            {cards.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-ink">{c.title}</span>
                <button
                  type="button"
                  onClick={() => restore.mutate({ entity: 'card', id: c.id })}
                  className="text-xs text-coral hover:underline"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
