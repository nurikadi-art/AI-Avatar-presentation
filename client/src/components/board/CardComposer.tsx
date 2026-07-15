import { useState } from 'react';

export function CardComposer({
  onAdd,
  disabled,
}: {
  onAdd: (title: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1.5 text-left text-sm text-latte hover:bg-sand/40 disabled:opacity-40"
      >
        + Add a card
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setTitle('');
          }
        }}
        placeholder="Card title…"
        rows={2}
        className="w-full resize-none rounded-lg border border-sand bg-paper p-2 text-sm text-ink outline-none focus:border-coral"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !title.trim()}
          className="rounded-md bg-coral px-3 py-1 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle('');
          }}
          className="rounded-md px-2 py-1 text-sm text-latte hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
