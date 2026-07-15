import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { CardDto, ListDto, Label, UserPublic, Id } from '@shared/types';
import { CardTile } from './CardTile';
import { CardComposer } from './CardComposer';
import { usePatchList, useArchiveList, useCreateCard } from '../../api/queries';

export function ListColumn({
  boardId,
  list,
  cards,
  labelById,
  memberById,
  today,
  disabled,
  onOpenCard,
}: {
  boardId: Id;
  list: ListDto;
  cards: CardDto[];
  labelById: Map<Id, Label>;
  memberById: Map<Id, UserPublic>;
  today: string;
  disabled: boolean;
  onOpenCard: (cardId: Id) => void;
}) {
  const patchList = usePatchList(boardId);
  const archiveList = useArchiveList(boardId);
  const createCard = useCreateCard(boardId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);

  const sortable = useSortable({
    id: `list:${list.id}`,
    data: { type: 'list', listId: list.id },
    disabled,
  });
  const droppable = useDroppable({ id: `column:${list.id}`, data: { type: 'column', listId: list.id } });

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== list.name) patchList.mutate({ listId: list.id, name: trimmed });
    else setName(list.name);
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className="flex max-h-full w-72 shrink-0 flex-col rounded-lg border border-sand bg-cream/60"
    >
      <div className="flex items-center gap-2 p-2">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setName(list.name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
          />
        ) : (
          <button
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setName(list.name);
                setEditing(true);
              }
            }}
            className="flex-1 cursor-grab text-left text-sm font-semibold text-ink"
          >
            {list.name || 'Untitled'}
          </button>
        )}
        <span className="text-xs text-latte">{cards.length}</span>
        <button
          type="button"
          aria-label="Archive list"
          disabled={disabled}
          onClick={() => {
            if (!disabled) archiveList.mutate(list.id);
          }}
          className="text-latte hover:text-rust disabled:opacity-40"
        >
          ×
        </button>
      </div>

      <div ref={droppable.setNodeRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={cards.map((c) => `card:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((c) => (
            <CardTile
              key={c.id}
              card={c}
              labelById={labelById}
              memberById={memberById}
              today={today}
              disabled={disabled}
              onOpen={() => onOpenCard(c.id)}
            />
          ))}
        </SortableContext>
        <CardComposer disabled={disabled} onAdd={(title) => createCard.mutate({ listId: list.id, title })} />
      </div>
    </div>
  );
}
