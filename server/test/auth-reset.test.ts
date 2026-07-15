import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { makeApp, seedUser, login } from './helpers.js';
import * as schema from '../src/db/schema.js';

type Db = BetterSQLite3Database<typeof schema>;

let app: FastifyInstance;
let db: Db;
let userId: string;

function makeReset(id: string, opts: { expiresInMs?: number; usedAt?: string | null } = {}) {
  db.insert(schema.passwordResets).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60 * 60 * 1000)).toISOString(),
    usedAt: opts.usedAt ?? null,
  }).run();
}

beforeEach(() => {
  const ctx = makeApp();
  app = ctx.app;
  db = ctx.db;
  userId = seedUser(db, { email: 'rob@x.com', name: 'Rob', password: 'old-password' }).id;
});

describe('POST /api/auth/reset-password', () => {
  it('sets a new password, logs in, and returns Me', async () => {
    makeReset('rst-1');
    const res = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-1', password: 'the-new-password' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('rob@x.com');
    expect(String(res.headers['set-cookie'])).toMatch(/sid=/);

    const good = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rob@x.com', password: 'the-new-password' } });
    expect(good.statusCode).toBe(200);
    const old = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rob@x.com', password: 'old-password' } });
    expect(old.statusCode).toBe(401);
  });

  it('rejects an unknown token with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'nope', password: 'the-new-password' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid or expired reset link');
  });

  it('rejects an expired token with 400', async () => {
    makeReset('rst-exp', { expiresInMs: -1000 });
    const res = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-exp', password: 'the-new-password' } });
    expect(res.statusCode).toBe(400);
  });

  it('is single-use: the second reset with the same token fails', async () => {
    makeReset('rst-once');
    const first = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-once', password: 'the-new-password' } });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-once', password: 'another-password' } });
    expect(second.statusCode).toBe(400);
  });

  it('revokes the user\'s existing sessions', async () => {
    const cookie = await login(app, 'rob@x.com', 'old-password');
    const before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(before.statusCode).toBe(200);

    makeReset('rst-revoke');
    await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-revoke', password: 'the-new-password' } });

    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });
});
