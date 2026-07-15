import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './client';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api', () => {
  it('returns parsed JSON on a 2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'u1' }), { status: 200 })),
    );
    const result = await api<{ id: string }>('/auth/me');
    expect(result).toEqual({ id: 'u1' });
  });

  it('throws ApiError carrying status and the server error message on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })),
    );
    await expect(api('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('falls back to a generic message when the error body has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(api('/boards')).rejects.toMatchObject({ status: 500, message: 'Something went wrong' });
  });

  it('always sends credentials and JSON content-type for a string body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await api('/boards', { method: 'POST', body: JSON.stringify({ name: 'x' }) });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/boards');
    expect(init.credentials).toBe('include');
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });
});
