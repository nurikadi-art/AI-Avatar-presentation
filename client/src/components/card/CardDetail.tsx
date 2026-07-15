import { useEffect, useState, type ReactNode } from 'react';
import type { UserPublic } from '@shared/types';
import { useCard, useBoard, usePatchCard, useArchiveCard } from '../../api/queries';
import { LabelPicker } from './LabelPicker';
import { DueDatePicker } from './DueDatePicker';
import { AssigneePicker } from './AssigneePicker';
import { Checklist } from './Checklist';
import { Attachments } from './Attachments';
import { Comments } from './Comments';
import { ActivityLog } from './ActivityLog';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-latte">{label}</h3>
      {children}
    </section>
  );
}

export function CardDetail({
  boardId,
  cardId,
  onClose,
}: {
  boardId: string;
  cardId: string;
  onClose: () => void;
}) {
  const cardQuery = useCard(cardId);
  const boardQuery = useBoard(boardId);
  const patchCard = usePatchCard();
  const archiveCard = useArchiveCard();
  const card = cardQuery.data;
  const board = boardQuery.data;

  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setTitle((t) => (t === null ? card.title : t));
      setDescription((d) => (d === null ? card.description : d));
    }
  }, [card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function saveTitle() {
    const next = (title ?? '').trim();
    if (card && next && next !== card.title) {
      patchCard.mutate({ cardId, boardId, patch: { title: next } });
    }
  }
  function saveDescription() {
    if (card && description !== null && description !== card.description) {
      patchCard.mutate({ cardId, boardId, patch: { description } });
    }
  }
  function archive() {
    archiveCard.mutate({ cardId, boardId }, { onSuccess: onClose });
  }

  const members: UserPublic[] = board?.board.members ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={card ? card.title : 'Card'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-[10px] border border-sand bg-paper p-6 shadow-sm"
      >
        {cardQuery.isLoading && <p className="text-latte">Loading card…</p>}
        {cardQuery.isError && <p className="text-red-700">Could not load this card.</p>}

        {card && (
          <>
            <div className="flex items-start justify-between gap-4">
              <input
                value={title ?? ''}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label="Card title"
                className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-xl font-semibold text-ink outline-none hover:border-sand focus:border-coral"
              />
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="shrink-0 text-latte hover:text-rust"
              >
                ✕
              </button>
            </div>

            <Field label="Description">
              <textarea
                value={description ?? ''}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                placeholder="Add a more detailed description…"
                rows={4}
                className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-coral"
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Labels">
                <LabelPicker
                  boardId={boardId}
                  cardId={cardId}
                  labels={board?.labels ?? []}
                  activeLabelIds={card.labelIds}
                />
              </Field>
              <Field label="Due date">
                <DueDatePicker boardId={boardId} cardId={cardId} dueDate={card.dueDate} />
              </Field>
              <Field label="Assignees">
                <AssigneePicker
                  boardId={boardId}
                  cardId={cardId}
                  members={members}
                  assigneeIds={card.assigneeIds}
                />
              </Field>
              <Field label="Checklist">
                <Checklist boardId={boardId} cardId={cardId} items={card.checklist} />
              </Field>
            </div>

            <Field label="Attachments">
              <Attachments boardId={boardId} cardId={cardId} attachments={card.attachments} />
            </Field>

            <Field label="Comments">
              <Comments boardId={boardId} cardId={cardId} comments={card.comments} members={members} />
            </Field>

            <Field label="Activity">
              <ActivityLog activity={card.activity} members={members} />
            </Field>

            <div className="mt-6 border-t border-sand pt-4">
              <button
                type="button"
                onClick={archive}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Archive card
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
