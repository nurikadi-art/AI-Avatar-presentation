import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import type { BoardDetail, Id } from '@shared/types';
import { useBoard, useMe, useMoveCard, useMoveList, useCreateList, qk } from '../api/queries';
import { useBoardChannel } from '../api/socket';
import { useToast } from '../components/ui/Toast';
import { moveCard, moveList, sortByPosition } from '../lib/boardMoves';
import { todayLocalISO } from '../lib/date';
import { BoardHeader } from '../components/board/BoardHeader';
import { ListColumn } from '../components/board/ListColumn';

interface DndItemData {
  type: 'card' | 'list' | 'column';
  cardId?: Id;
  listId?: Id;
}

export function BoardPage() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const board = useBoard(boardId);
  const me = useMe();
  const { connected, presence } = useBoardChannel(boardId);
  const toast = useToast();
  const moveCardMut = useMoveCard(boardId);
  const moveListMut = useMoveList(boardId);
  const createList = useCreateList(boardId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [addingList, setAddingList] = useState(false);
  const [listName, setListName] = useState('');

  const disabled = !connected;

  const onDragEnd = (e: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current as DndItemData | undefined;
    const overData = over.data.current as DndItemData | undefined;
    if (!activeData) return;
    const detail = qc.getQueryData<BoardDetail>(qk.board(boardId));
    if (!detail) return;

    if (activeData.type === 'list') {
      const listId = activeData.listId!;
      const overListId = overData?.listId;
      if (!overListId || overListId === listId) return;
      const dest = sortByPosition(detail.lists.filter((l) => l.id !== listId && l.archivedAt === null));
      const toIndex = dest.findIndex((l) => l.id === overListId);
      if (toIndex < 0) return;
      const next = moveList(detail, { listId, toIndex });
      qc.setQueryData(qk.board(boardId), next);
      const moved = next.lists.find((l) => l.id === listId)!;
      moveListMut.mutate(
        { listId, position: moved.position },
        { onError: () => toast('Could not move list') },
      );
      return;
    }

    const cardId = activeData.cardId!;
    let toListId: Id;
    let toIndex: number;
    if (overData?.type === 'card') {
      toListId = overData.listId!;
      const dest = sortByPosition(
        detail.cards.filter((c) => c.listId === toListId && c.id !== cardId && c.archivedAt === null),
      );
      const overIndex = dest.findIndex((c) => c.id === overData.cardId);
      toIndex = overIndex < 0 ? dest.length : overIndex;
    } else if (overData?.type === 'column' || overData?.type === 'list') {
      toListId = overData.listId!;
      toIndex = detail.cards.filter(
        (c) => c.listId === toListId && c.id !== cardId && c.archivedAt === null,
      ).length;
    } else {
      return;
    }
    const next = moveCard(detail, { cardId, toListId, toIndex });
    qc.setQueryData(qk.board(boardId), next);
    const moved = next.cards.find((c) => c.id === cardId)!;
    moveCardMut.mutate(
      { cardId, listId: moved.listId, position: moved.position },
      { onError: () => toast('Could not move card') },
    );
  };

  const submitList = () => {
    const trimmed = listName.trim();
    if (!trimmed) return;
    createList.mutate(trimmed, { onSuccess: () => setListName('') });
  };

  if (board.isLoading) return <div className="p-6 text-latte">Loading board…</div>;
  if (board.isError || !board.data)
    return <div className="p-6 text-red-700">Could not load this board.</div>;

  const detail = board.data;
  const labelById = new Map(detail.labels.map((l) => [l.id, l]));
  const memberById = new Map(detail.board.members.map((m) => [m.id, m]));
  const presentIds = new Set(presence.map((p) => p.id));
  const today = todayLocalISO();
  const lists = sortByPosition(detail.lists.filter((l) => l.archivedAt === null));
  const cardsForList = (listId: Id) =>
    sortByPosition(detail.cards.filter((c) => c.listId === listId && c.archivedAt === null));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {!connected && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
          Reconnecting… changes are paused
        </div>
      )}
      <BoardHeader
        boardId={boardId}
        board={detail.board}
        members={detail.board.members}
        presentIds={presentIds}
        isAdmin={me.data?.isAdmin ?? false}
        disabled={disabled}
      />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex flex-1 items-start gap-3 overflow-x-auto p-4">
          <SortableContext
            items={lists.map((l) => `list:${l.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {lists.map((l) => (
              <ListColumn
                key={l.id}
                boardId={boardId}
                list={l}
                cards={cardsForList(l.id)}
                labelById={labelById}
                memberById={memberById}
                today={today}
                disabled={disabled}
                onOpenCard={(cardId) => navigate(`/b/${boardId}/c/${cardId}`)}
              />
            ))}
          </SortableContext>

          <div className="w-72 shrink-0">
            {addingList ? (
              <div className="flex flex-col gap-2 rounded-lg border border-sand bg-cream/60 p-2">
                <input
                  autoFocus
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitList();
                    if (e.key === 'Escape') {
                      setAddingList(false);
                      setListName('');
                    }
                  }}
                  placeholder="List name…"
                  className="w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitList}
                    disabled={disabled || !listName.trim()}
                    className="rounded-md bg-coral px-3 py-1 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
                  >
                    Add list
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingList(false);
                      setListName('');
                    }}
                    className="rounded-md px-2 py-1 text-sm text-latte hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAddingList(true)}
                className="w-full rounded-lg border border-dashed border-sand bg-paper/60 px-3 py-2 text-left text-sm text-latte hover:border-coral hover:text-coral disabled:opacity-40"
              >
                + Add a list
              </button>
            )}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
