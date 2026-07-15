import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HomePage } from './HomePage';
import type { BoardSummary } from '@shared/types';

const apiMock = vi.fn();
vi.mock('../api/client', () => ({
  api: (path: string, opts?: RequestInit) => apiMock(path, opts),
  ApiError: class extends Error {},
}));

function board(over: Partial<BoardSummary>): BoardSummary {
  return {
    id: 'b',
    name: 'B',
    accentColor: 'coral',
    visibility: 'team',
    starred: false,
    cardCount: 0,
    memberCount: 1,
    archivedAt: null,
    ...over,
  };
}

function renderHome(boards: BoardSummary[]) {
  apiMock.mockImplementation((path: string) =>
    path === '/boards' ? Promise.resolve(boards) : Promise.resolve([]),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => apiMock.mockReset());

  it('shows the empty state when there are no boards', async () => {
    renderHome([]);
    expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create your first board/i }),
    ).toBeInTheDocument();
  });

  it('groups boards into Starred, Team, and Private sections', async () => {
    renderHome([
      board({ id: 's1', name: 'Alpha', visibility: 'team', starred: true }),
      board({ id: 't1', name: 'Beta', visibility: 'team' }),
      board({ id: 'p1', name: 'Gamma', visibility: 'private' }),
    ]);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Starred')).toBeInTheDocument();
    expect(screen.getByText('Team boards')).toBeInTheDocument();
    expect(screen.getByText('Private boards')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ new board/i })).toBeInTheDocument();
  });
});
