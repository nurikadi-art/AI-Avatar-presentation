import type { UserPublic } from '@shared/types';
import { Avatar } from '../ui/Avatar';
import { useAddAssignee, useRemoveAssignee } from '../../api/queries';

export function AssigneePicker({
  boardId,
  cardId,
  members,
  assigneeIds,
}: {
  boardId: string;
  cardId: string;
  members: UserPublic[];
  assigneeIds: string[];
}) {
  const addAssignee = useAddAssignee();
  const removeAssignee = useRemoveAssignee();
  const active = new Set(assigneeIds);

  function toggle(userId: string) {
    if (active.has(userId)) removeAssignee.mutate({ cardId, boardId, userId });
    else addAssignee.mutate({ cardId, boardId, userId });
  }

  return (
    <ul className="flex flex-col gap-1">
      {members.map((m) => (
        <li key={m.id}>
          <label className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-sand/30">
            <input type="checkbox" checked={active.has(m.id)} onChange={() => toggle(m.id)} />
            <Avatar name={m.name} color={m.avatarColor} size={24} />
            <span className="text-sm text-ink">{m.name}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
