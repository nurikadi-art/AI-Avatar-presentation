import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LABEL_HEX, type CardDto, type Label, type UserPublic, type Id } from '@shared/types';
import { Avatar } from '../ui/Avatar';
import { isOverdue } from '../../lib/date';

function formatDue(dueDate: string): string {
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function CardTile({
  card,
  labelById,
  memberById,
  today,
  onOpen,
  disabled,
}: {
  card: CardDto;
  labelById: Map<Id, Label>;
  memberById: Map<Id, UserPublic>;
  today: string;
  onOpen: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card:${card.id}`,
    data: { type: 'card', cardId: card.id, listId: card.listId },
    disabled,
  });

  const labels = card.labelIds.map((id) => labelById.get(id)).filter((l): l is Label => !!l);
  const assignees = card.assigneeIds
    .map((id) => memberById.get(id))
    .filter((u): u is UserPublic => !!u);
  const doneCount = card.checklist.filter((i) => i.done).length;
  const overdue = isOverdue(card.dueDate, today);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-sand bg-paper p-2.5 hover:border-latte"
    >
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => (
            <span
              key={l.id}
              className="h-1.5 w-8 rounded-full"
              style={{ backgroundColor: LABEL_HEX[l.color] }}
              title={l.name}
            />
          ))}
        </div>
      )}

      <p className="text-sm text-ink">{card.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-latte">
        {card.dueDate && (
          <span
            className={`rounded px-1.5 py-0.5 ${
              overdue ? 'bg-red-100 text-red-800' : 'bg-sand/60 text-rust'
            }`}
          >
            {formatDue(card.dueDate)}
          </span>
        )}
        {card.checklist.length > 0 && (
          <span aria-label="checklist progress">
            ✓ {doneCount}/{card.checklist.length}
          </span>
        )}
        {card.commentCount > 0 && <span aria-label="comment count">💬 {card.commentCount}</span>}
        {card.attachmentCount > 0 && (
          <span aria-label="attachment count">📎 {card.attachmentCount}</span>
        )}
        {assignees.length > 0 && (
          <span className="ml-auto flex -space-x-1">
            {assignees.map((u) => (
              <Avatar key={u.id} name={u.name} color={u.avatarColor} size={20} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
