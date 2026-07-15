import { usePatchCard } from '../../api/queries';

export function DueDatePicker({
  boardId,
  cardId,
  dueDate,
}: {
  boardId: string;
  cardId: string;
  dueDate: string | null;
}) {
  const patchCard = usePatchCard();
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={dueDate ?? ''}
        onChange={(e) =>
          patchCard.mutate({ cardId, boardId, patch: { dueDate: e.target.value || null } })
        }
        className="rounded-md border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
      />
      {dueDate && (
        <button
          type="button"
          onClick={() => patchCard.mutate({ cardId, boardId, patch: { dueDate: null } })}
          className="text-sm text-latte hover:text-red-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}
