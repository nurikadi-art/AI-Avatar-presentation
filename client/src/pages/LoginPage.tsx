import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useLogin } from '../api/queries';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[10px] border border-sand bg-paper p-8"
      >
        <h1 className="text-center text-2xl font-semibold text-ink">company trello</h1>
        <label className="flex flex-col gap-1 text-sm text-rust">
          Email
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-rust">
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {login.isError && (
          <p className="text-sm text-red-700" role="alert">
            {login.error instanceof ApiError ? login.error.message : 'Something went wrong'}
          </p>
        )}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
