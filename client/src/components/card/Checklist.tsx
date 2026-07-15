import { useState } from 'react';
import type { ChecklistItemDto } from '@shared/types';
import {
  useAddChecklistItem,
  usePatchChecklistItem,
  useDeleteChecklistItem,
} from '../../api/queries';

export function Checklist({
  boardId,
  cardId,
  items,
}: {
  boardId: string;
  cardId: string;
  items: ChecklistItemDto[];
}) {
  const addItem = useAddChecklistItem();
  const patchItem = usePatchChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const done = items.filter((i) => i.done).length;

  function add() {
    const text = newText.trim();
    if (!text) return;
    addItem.mutate({ cardId, boardId, text }, { onSuccess: () => setNewText('') });
  }
  function startEdit(item: ChecklistItemDto) {
    setEditingId(item.id);
    setEditText(item.text);
  }
  function saveEdit() {
    if (!editingId) return;
    const text = editText.trim();
    if (text) patchItem.mutate({ itemId: editingId, cardId, boardId, patch: { text } });
    setEditingId(null);
  }

  return (
    <div>
      <p className="mb-2 text-sm text-latte">
        {done}/{items.length} done
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() =>
                patchItem.mutate({ itemId: item.id, cardId, boardId, patch: { done: !item.done } })
              }
            />
            {editingId === item.id ? (
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                className="flex-1 rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
              />
            ) : (
              <button
                type="button"
                onClick={() => startEdit(item)}
                className={`flex-1 text-left text-sm ${
                  item.done ? 'text-latte line-through' : 'text-ink'
                }`}
              >
                {item.text}
              </button>
            )}
            <button
              type="button"
              aria-label="Delete item"
              onClick={() => deleteItem.mutate({ itemId: item.id, cardId, boardId })}
              className="text-xs text-latte hover:text-red-700"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add an item"
          className="flex-1 rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-coral px-3 py-1 text-sm font-medium text-paper hover:bg-rust"
        >
          Add
        </button>
      </div>
    </div>
  );
}
