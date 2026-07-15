import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { makeApp, seedUser } from './helpers.js';
import * as schema from '../src/db/schema.js';

type Db = BetterSQLite3Database<typeof schema>;

let app: FastifyInstance;
let db: Db;
let adminId: string;

function makeInvite(id: string, email: string, opts: { expiresInMs?: number; usedAt?: string | null } = {}) {
  db.insert(schema.invites).values({
    id,
    email,
    invitedBy: adminId,
    expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 7 * 24 * 60 * 60 * 1000)).toISOString(),
    usedAt: opts.usedAt ?? null,
  }).run();
}

beforeEach(() => {
  const ctx = makeApp();
  app = ctx.app;
  db = ctx.db;
  adminId = seedUser(db, { email: 'admin@x.com', name: 'Admin', password: 'admin-pass', isAdmin: true }).id;
});

describe('POST /api/auth/accept-invite', () => {
  it('creates a user, logs them in, and returns Me', async () => {
    makeInvite('inv-1', 'new@x.com');
    const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-1', name: 'Newbie', password: 'brand-new-pw' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: 'new@x.com', name: 'Newbie', isAdmin: false });
    const cookie = String(res.headers['set-cookie']).split(';')[0];
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe('new@x.com');
  });

  it('rejects an unknown token with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'nope', name: 'X', password: 'brand-new-pw' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid or expired invite');
  });

  it('rejects an expired token with 400', async () => {
    makeInvite('inv-exp', 'exp@x.com', { expiresInMs: -1000 });
    const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-exp', name: 'X', password: 'brand-new-pw' } });
    expect(res.statusCode).toBe(400);
  });

  it('is single-use: the second accept with the same token fails', async () => {
    makeInvite('inv-once', 'once@x.com');
    const first = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-once', name: 'Once', password: 'brand-new-pw' } });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-once', name: 'Twice', password: 'brand-new-pw' } });
    expect(second.statusCode).toBe(400);
  });

  it('invalidates other pending invites for the same email', async () => {
    makeInvite('inv-a', 'dup@x.com');
    makeInvite('inv-b', 'dup@x.com');
    await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-a', name: 'Dup', password: 'brand-new-pw' } });
    const other = db.select().from(schema.invites).where(eq(schema.invites.id, 'inv-b')).get()!;
    expect(other.usedAt).not.toBeNull();
  });

  it('rejects when an account with the email already exists', async () => {
    seedUser(db, { email: 'taken@x.com', name: 'Taken', password: 'pw' });
    makeInvite('inv-taken', 'taken@x.com');
    const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-taken', name: 'X', password: 'brand-new-pw' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('An account with this email already exists');
  });
});
