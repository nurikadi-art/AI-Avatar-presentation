import { useState } from 'react';
import type { UserPublic, BoardSummary } from '@shared/types';
import {
  useAdminMembers,
  useArchivedBoards,
  useCreateInvite,
  usePatchMember,
  useResetMemberPassword,
  useRestoreBoard,
  usePurgeBoard,
} from '../api/queries';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        readOnly
        value={value}
        className="flex-1 rounded border border-sand bg-cream px-2 py-1 text-xs text-ink"
      />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded border border-sand px-2 py-1 text-xs text-rust hover:border-coral"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function AdminPage() {
  const overview = useAdminMembers();
  const archived = useArchivedBoards();
  const createInvite = useCreateInvite();
  const patchMember = usePatchMember();
  const resetPassword = useResetMemberPassword();
  const restoreBoard = useRestoreBoard();
  const purgeBoard = usePurgeBoard();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [resetLinks, setResetLinks] = useState<Record<string, string>>({});

  const data = overview.data;

  function purge(board: BoardSummary) {
    if (window.confirm(`Permanently delete "${board.name}"? This cannot be undone.`)) {
      purgeBoard.mutate(board.id);
    }
  }
  function sendInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    createInvite.mutate(email, {
      onSuccess: (res) => {
        setInviteLink(res.link);
        setInviteEmail('');
      },
    });
  }
  function reset(userId: string) {
    resetPassword.mutate(userId, {
      onSuccess: (res) => setResetLinks((prev) => ({ ...prev, [userId]: res.link })),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-ink">Admin</h1>

      {data && !data.emailConfigured && (
        <div className="mt-4 rounded-md border border-sun bg-sun/15 px-4 py-3 text-sm text-rust">
          Email isn't configured — invite and reset links must be shared by copy-link.
        </div>
      )}

      <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
        <h2 className="text-lg font-semibold text-ink">Invite a teammate</h2>
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            className="flex-1 rounded-md border border-sand bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={sendInvite}
            disabled={!inviteEmail.trim() || createInvite.isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
          >
            {createInvite.isPending ? 'Creating…' : 'Send invite'}
          </button>
        </div>
        {inviteLink && (
          <div className="mt-3">
            <p className="text-xs text-latte">
              {data?.emailConfigured
                ? 'This invite link was emailed. You can also copy it to share directly:'
                : 'Copy this invite link to share (email is not configured):'}
            </p>
            <CopyField value={inviteLink} />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
        <h2 className="text-lg font-semibold text-ink">Members</h2>
        {overview.isLoading && <p className="mt-2 text-latte">Loading…</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-latte">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.members ?? []).map((m: UserPublic) => (
                <tr key={m.id} className="border-t border-sand align-top">
                  <td className="py-2 text-ink">{m.name}</td>
                  <td className="py-2 text-latte">{m.email}</td>
                  <td className="py-2">{m.isAdmin ? 'Admin' : 'Member'}</td>
                  <td className="py-2">
                    {m.deactivated ? <span className="text-red-700">Deactivated</span> : 'Active'}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          patchMember.mutate({ userId: m.id, patch: { deactivated: !m.deactivated } })
                        }
                        className="text-xs text-rust hover:underline"
                      >
                        {m.deactivated ? 'Reactivate' : 'Deactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patchMember.mutate({ userId: m.id, patch: { isAdmin: !m.isAdmin } })
                        }
                        className="text-xs text-rust hover:underline"
                      >
                        {m.isAdmin ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        type="button"
                        onClick={() => reset(m.id)}
                        className="text-xs text-rust hover:underline"
                      >
                        Reset password
                      </button>
                    </div>
                    {resetLinks[m.id] && <CopyField value={resetLinks[m.id]} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
        <h2 className="text-lg font-semibold text-ink">Storage</h2>
        <p className="mt-1 text-sm text-latte">
          {data ? `${formatBytes(data.diskUsageBytes)} of attachments stored.` : 'Loading…'}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
        <h2 className="text-lg font-semibold text-ink">Archived boards</h2>
        {archived.isLoading && <p className="mt-2 text-sm text-latte">Loading…</p>}
        {archived.data && archived.data.length === 0 && (
          <p className="mt-2 text-sm text-latte">No archived boards.</p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {(archived.data ?? []).map((b: BoardSummary) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-md border border-sand bg-cream px-3 py-2"
            >
              <span className="truncate text-sm text-ink">{b.name}</span>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => restoreBoard.mutate(b.id)}
                  className="text-xs text-rust hover:underline"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => purge(b)}
                  className="text-xs text-red-700 hover:underline"
                >
                  Purge
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
