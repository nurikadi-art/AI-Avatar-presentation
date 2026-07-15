import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { NotificationDto } from '@shared/types';
import { useNotifications, useMarkNotificationsRead } from '../api/queries';

function describeNotification(n: NotificationDto): string {
  switch (n.type) {
    case 'assigned':
      return 'assigned you to';
    case 'mentioned':
      return 'mentioned you on';
    case 'comment_on_your_card':
      return 'commented on';
    case 'due_soon':
      return 'is due soon:';
    default:
      return 'updated';
  }
}

export function NotificationsBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications = data ?? [];
  const unread = notifications.filter((n) => n.readAt === null).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative text-latte hover:text-rust"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-paper">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-sand bg-paper shadow-sm">
          <div className="flex items-center justify-between border-b border-sand px-3 py-2">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            <button
              type="button"
              onClick={() => markRead.mutate(undefined)}
              disabled={unread === 0}
              className="text-xs text-rust hover:underline disabled:text-latte disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {notifications.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-latte">You're all caught up.</li>
            )}
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  to={`/b/${n.boardId}/c/${n.cardId}`}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-sm hover:bg-sand/40 ${
                    n.readAt === null ? 'bg-sun/10' : ''
                  }`}
                >
                  <span className="text-ink">
                    {n.actorName ? `${n.actorName} ` : ''}
                    {describeNotification(n)} <span className="font-medium">{n.cardTitle}</span>
                  </span>
                  <div className="mt-0.5 text-xs text-latte">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
