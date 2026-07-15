import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';

const { fakeSocket } = vi.hoisted(() => {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    fakeSocket: {
      connected: true,
      emit: vi.fn(),
      on(event: string, cb: (...args: unknown[]) => void) {
        (handlers[event] ??= []).push(cb);
      },
      off(event: string, cb: (...args: unknown[]) => void) {
        handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
      },
      server(event: string, ...args: unknown[]) {
        (handlers[event] ?? []).forEach((h) => h(...args));
      },
    },
  };
});

vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

import { useBoardChannel } from './socket';

function renderChannel(boardId: string, qc: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBoardChannel(boardId), { wrapper });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useBoardChannel', () => {
  it('coalesces rapid board:changed events into one invalidation after 150ms', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
    renderChannel('board1', qc);

    fakeSocket.server('board:changed', { boardId: 'board1', byUserId: 'u2' });
    fakeSocket.server('board:changed', { boardId: 'board1', byUserId: 'u2' });
    fakeSocket.server('board:changed', { boardId: 'board1', byUserId: 'u2' });
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['board', 'board1'] });
  });

  it('ignores board:changed for a different board', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
    renderChannel('board1', qc);

    fakeSocket.server('board:changed', { boardId: 'other', byUserId: 'u2' });
    vi.advanceTimersByTime(150);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
