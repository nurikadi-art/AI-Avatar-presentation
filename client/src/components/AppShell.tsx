import { type ReactNode, type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMe, useLogout } from '../api/queries';
import { Avatar } from './ui/Avatar';
import { Menu, type MenuItem } from './ui/Menu';
import { Input } from './ui/Input';
import { NotificationsBell } from './NotificationsBell';

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
  };

  const onLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  };

  const menuItems: MenuItem[] = me.data
    ? [
        { label: 'Settings', onSelect: () => navigate('/settings') },
        ...(me.data.isAdmin ? [{ label: 'Admin', onSelect: () => navigate('/admin') }] : []),
        { label: 'Log out', onSelect: onLogout },
      ]
    : [];

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex h-14 items-center gap-4 border-b border-sand bg-paper px-4">
        <Link to="/" className="shrink-0 font-semibold text-ink">
          company trello
        </Link>
        <form onSubmit={onSearch} className="max-w-md flex-1">
          <Input
            type="search"
            placeholder="Search cards…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search cards"
          />
        </form>
        <div className="ml-auto flex items-center gap-3">
          <NotificationsBell />
          {me.data && (
            <Menu
              trigger={<Avatar name={me.data.name} color={me.data.avatarColor} />}
              items={menuItems}
            />
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
