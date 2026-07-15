import { useState } from 'react';
import type { ActivityDto, UserPublic } from '@shared/types';

export function ActivityLog({
  activity,
  members,
}: {
  activity: ActivityDto[];
  members: UserPublic[];
}) {
  const [open, setOpen] = useState(false);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-rust hover:underline"
      >
        {open ? 'Hide' : 'Show'} activity ({activity.length})
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1">
          {activity.map((a) => (
            <li key={a.id} className="text-sm text-latte">
              <span className="text-ink">{nameById.get(a.actorId) ?? 'Someone'}</span>{' '}
              {a.type.replace(/[._]/g, ' ')}{' '}
              <span className="text-xs">· {new Date(a.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
