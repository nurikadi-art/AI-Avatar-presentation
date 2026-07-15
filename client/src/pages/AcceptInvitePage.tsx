import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAcceptInvite } from '../api/queries';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function AcceptInvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    accept.mutate({ token, name, password }, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[10px] border border-sand bg-paper p-8"
      >
        <h1 className="text-center text-2xl font-semibold text-ink">Join the team</h1>
        <p className="text-center text-sm text-latte">Set your name and a password to finish.</p>
        <label className="flex flex-col gap-1 text-sm text-rust">
          Name
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-rust">
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        {accept.isError && (
          <p className="text-sm text-red-700" role="alert">
            {accept.error instanceof ApiError ? accept.error.message : 'Something went wrong'}
          </p>
        )}
        <Button type="submit" disabled={accept.isPending}>
          {accept.isPending ? 'Joining…' : 'Join'}
        </Button>
      </form>
    </div>
  );
}
