import { useEffect, useState, type FormEvent } from 'react';
import { LABEL_HEX, type LabelColor } from '@shared/types';
import { useMe, useUpdateProfile, useChangePassword } from '../api/queries';
import { ApiError } from '../api/client';

const COLORS: LabelColor[] = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

export function SettingsPage() {
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    if (me.data) setName((n) => (n === '' ? me.data!.name : n));
  }, [me.data]);

  if (!me.data) return <div className="p-6 text-latte">Loading…</div>;
  const user = me.data;

  function saveName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== user.name) updateProfile.mutate({ name: trimmed });
  }
  function submitPassword(e: FormEvent) {
    e.preventDefault();
    setPwOk(false);
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPwOk(true);
          setCurrentPassword('');
          setNewPassword('');
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Settings</h1>

      <section className="mt-6">
        <label htmlFor="settings-name" className="block text-sm font-medium text-rust">
          Display name
        </label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="mt-1 w-full rounded-md border border-sand bg-paper px-3 py-2 text-ink outline-none focus:border-coral"
        />
      </section>

      <section className="mt-6">
        <span className="block text-sm font-medium text-rust">Avatar color</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={user.avatarColor === c}
              onClick={() => updateProfile.mutate({ avatarColor: c })}
              style={{ backgroundColor: LABEL_HEX[c] }}
              className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-cream ${
                user.avatarColor === c ? 'ring-ink' : 'ring-transparent'
              }`}
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={user.emailNotifications}
            onChange={() => updateProfile.mutate({ emailNotifications: !user.emailNotifications })}
          />
          Email me notifications
        </label>
      </section>

      <form onSubmit={submitPassword} className="mt-8 border-t border-sand pt-6">
        <h2 className="text-lg font-semibold text-ink">Change password</h2>
        <label htmlFor="cur-pw" className="mt-3 block text-sm font-medium text-rust">
          Current password
        </label>
        <input
          id="cur-pw"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-sand bg-paper px-3 py-2 text-ink outline-none focus:border-coral"
        />
        <label htmlFor="new-pw" className="mt-3 block text-sm font-medium text-rust">
          New password
        </label>
        <input
          id="new-pw"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-sand bg-paper px-3 py-2 text-ink outline-none focus:border-coral"
        />
        {changePassword.isError && (
          <p className="mt-2 text-sm text-red-700">
            {changePassword.error instanceof ApiError
              ? changePassword.error.message
              : 'Something went wrong'}
          </p>
        )}
        {pwOk && <p className="mt-2 text-sm text-green-700">Password changed.</p>}
        <button
          type="submit"
          disabled={changePassword.isPending}
          className="mt-4 rounded-md bg-coral px-4 py-2 font-medium text-paper hover:bg-rust disabled:opacity-50"
        >
          {changePassword.isPending ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  );
}
