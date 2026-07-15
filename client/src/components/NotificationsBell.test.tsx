import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationsBell } from './NotificationsBell';
import type { NotificationDto } from '@shared/types';

const apiMock = vi.fn();
vi.mock('../api/client', () => ({
  api: (path: string, opts?: RequestInit) => apiMock(path, opts),
  ApiError: class extends Error {},
}));

function notif(over: Partial<NotificationDto>): NotificationDto {
  return {
    id: 'n',
    type: 'assigned',
    cardId: 'c1',
    cardTitle: 'Card One',
    boardId: 'b1',
    actorId: 'u2',
    actorName: 'Alice',
    readAt: null,
    createdAt: '2026-07-14T10:00:00.000Z',
    ...over,
  };
}

function renderBell(notifications: NotificationDto[]) {
  apiMock.mockImplementation((path: string) =>
    path === '/notifications' ? Promise.resolve(notifications) : Promise.resolve(undefined),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationsBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsBell', () => {
  beforeEach(() => apiMock.mockReset());

  it('shows the unread-count badge and lists notifications on open', async () => {
    renderBell([
      notif({ id: 'n1', readAt: null }),
      notif({ id: 'n2', readAt: '2026-07-14T09:00:00.000Z' }),
    ]);
    expect(await screen.findByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findAllByText('Card One')).toHaveLength(2);
  });

  it('marks all read via POST /notifications/read', async () => {
    renderBell([notif({ id: 'n1', readAt: null })]);
    await screen.findByText('1');
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    fireEvent.click(await screen.findByRole('button', { name: /mark all read/i }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/notifications/read',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      ),
    );
  });
});
