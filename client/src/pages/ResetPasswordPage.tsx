import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useResetPassword } from '../api/queries';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function ResetPasswordPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const [password, setPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    reset.mutate({ token, password }, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[10px] border border-sand bg-paper p-8"
      >
        <h1 className="text-center text-2xl font-semibold text-ink">Set a new password</h1>
        <label className="flex flex-col gap-1 text-sm text-rust">
          New password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        {reset.isError && (
          <p className="text-sm text-red-700" role="alert">
            {reset.error instanceof ApiError ? reset.error.message : 'Something went wrong'}
          </p>
        )}
        <Button type="submit" disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </div>
  );
}
