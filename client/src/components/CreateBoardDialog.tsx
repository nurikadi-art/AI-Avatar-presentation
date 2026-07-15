import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LABEL_HEX, type LabelColor, type Visibility } from '@shared/types';
import { useCreateBoard } from '../api/queries';

const COLORS: LabelColor[] = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

export function CreateBoardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('team');
  const [accentColor, setAccentColor] = useState<LabelColor>('coral');
  const createBoard = useCreateBoard();
  const navigate = useNavigate();

  if (!open) return null;

  function reset() {
    setName('');
    setVisibility('team');
    setAccentColor('coral');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || createBoard.isPending) return;
    createBoard.mutate(
      { name: trimmed, visibility, accentColor },
      {
        onSuccess: (detail) => {
          reset();
          onClose();
          navigate(`/b/${detail.board.id}`);
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-sand bg-paper p-6"
      >
        <h2 className="text-lg font-semibold text-ink">New board</h2>

        <label htmlFor="board-name" className="mt-4 block text-sm font-medium text-rust">
          Board name
        </label>
        <input
          id="board-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Product Roadmap"
          className="mt-1 w-full rounded-md border border-sand bg-cream px-3 py-2 text-ink outline-none focus:border-coral"
        />

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-rust">Visibility</legend>
          <div className="mt-1 flex gap-2">
            {(['team', 'private'] as Visibility[]).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVisibility(v)}
                aria-pressed={visibility === v}
                className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                  visibility === v ? 'border-coral bg-coral/10 text-coral' : 'border-sand text-latte'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-rust">Accent color</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={c}
                aria-pressed={accentColor === c}
                onClick={() => setAccentColor(c)}
                style={{ backgroundColor: LABEL_HEX[c] }}
                className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-paper ${
                  accentColor === c ? 'ring-ink' : 'ring-transparent'
                }`}
              />
            ))}
          </div>
        </fieldset>

        {createBoard.isError && (
          <p className="mt-3 text-sm text-red-700">Could not create board. Try again.</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-latte hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || createBoard.isPending}
            className="rounded-md bg-coral px-4 py-2 font-medium text-paper hover:bg-rust disabled:opacity-50"
          >
            {createBoard.isPending ? 'Creating…' : 'Create board'}
          </button>
        </div>
      </form>
    </div>
  );
}
