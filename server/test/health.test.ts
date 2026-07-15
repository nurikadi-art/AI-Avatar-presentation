import { describe, it, expect } from 'vitest';
import { makeApp } from './helpers.js';

describe('GET /api/health', () => {
  it('returns { status: "ok" }', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
