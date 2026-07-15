import { useState } from 'react';
import { LABEL_HEX, type Label, type LabelColor } from '@shared/types';
import {
  useAddCardLabel,
  useRemoveCardLabel,
  useCreateLabel,
  usePatchLabel,
  useDeleteLabel,
} from '../../api/queries';

const COLORS: LabelColor[] = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

function SwatchRow({ value, onChange }: { value: LabelColor; onChange: (c: LabelColor) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          style={{ backgroundColor: LABEL_HEX[c] }}
          className={`h-6 w-6 rounded ${
            value === c ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : ''
          }`}
        />
      ))}
    </div>
  );
}

export function LabelPicker({
  boardId,
  cardId,
  labels,
  activeLabelIds,
}: {
  boardId: string;
  cardId: string;
  labels: Label[];
  activeLabelIds: string[];
}) {
  const addLabel = useAddCardLabel();
  const removeLabel = useRemoveCardLabel();
  const createLabel = useCreateLabel();
  const patchLabel = usePatchLabel();
  const deleteLabel = useDeleteLabel();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState<LabelColor>('coral');

  const active = new Set(activeLabelIds);

  function startCreate() {
    setEditingId('new');
    setDraftName('');
    setDraftColor('coral');
  }
  function startEdit(label: Label) {
    setEditingId(label.id);
    setDraftName(label.name);
    setDraftColor(label.color);
  }
  function cancel() {
    setEditingId(null);
  }
  function save() {
    if (editingId === 'new') {
      createLabel.mutate({ boardId, name: draftName.trim(), color: draftColor }, { onSuccess: cancel });
    } else if (editingId) {
      patchLabel.mutate(
        { labelId: editingId, boardId, patch: { name: draftName.trim(), color: draftColor } },
        { onSuccess: cancel },
      );
    }
  }
  function toggle(label: Label) {
    if (active.has(label.id)) removeLabel.mutate({ cardId, boardId, labelId: label.id });
    else addLabel.mutate({ cardId, boardId, labelId: label.id });
  }

  return (
    <div className="w-64">
      <ul className="flex flex-col gap-1">
        {labels.map((label) =>
          editingId === label.id ? (
            <li key={label.id} className="rounded-md border border-sand bg-cream p-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Label name"
                className="mb-2 w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
              />
              <SwatchRow value={draftColor} onChange={setDraftColor} />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <button type="button" onClick={save} className="text-sm font-medium text-coral">
                    Save
                  </button>
                  <button type="button" onClick={cancel} className="text-sm text-latte">
                    Cancel
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => deleteLabel.mutate({ labelId: label.id, boardId }, { onSuccess: cancel })}
                  className="text-sm text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ) : (
            <li key={label.id} className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 hover:bg-sand/30">
                <input type="checkbox" checked={active.has(label.id)} onChange={() => toggle(label)} />
                <span className="h-4 w-8 rounded" style={{ backgroundColor: LABEL_HEX[label.color] }} />
                <span className="flex-1 truncate text-sm text-ink">
                  {label.name || <span className="text-latte">({label.color})</span>}
                </span>
              </label>
              <button
                type="button"
                aria-label={`Edit ${label.name || label.color} label`}
                onClick={() => startEdit(label)}
                className="text-xs text-latte hover:text-rust"
              >
                Edit
              </button>
            </li>
          ),
        )}
      </ul>

      {editingId === 'new' ? (
        <div className="mt-2 rounded-md border border-sand bg-cream p-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Label name"
            autoFocus
            className="mb-2 w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
          />
          <SwatchRow value={draftColor} onChange={setDraftColor} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={save} className="text-sm font-medium text-coral">
              Create
            </button>
            <button type="button" onClick={cancel} className="text-sm text-latte">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCreate}
          className="mt-2 w-full rounded-md border border-dashed border-sand py-1.5 text-sm text-latte hover:border-coral hover:text-coral"
        >
          + New label
        </button>
      )}
    </div>
  );
}
