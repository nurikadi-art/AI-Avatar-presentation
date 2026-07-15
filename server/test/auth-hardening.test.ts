import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { makeApp, seedUser, login } from './helpers.js';
import * as schema from '../src/db/schema.js';

type Db = BetterSQLite3Database<typeof schema>;

let app: FastifyInstance;
let db: Db;
let userId: string;

beforeEach(() => {
  const ctx = makeApp();
  app = ctx.app;
  db = ctx.db;
  userId = seedUser(db, { email: 'dee@x.com', name: 'Dee', password: 'her-password' }).id;
});

function deactivate() {
  db.update(schema.users).set({ deactivatedAt: new Date().toISOString() }).where(eq(schema.users.id, userId)).run();
}

describe('deactivated users', () => {
  it('cannot log in (generic 401)', async () => {
    deactivate();
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dee@x.com', password: 'her-password' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid email or password');
  });

  it('have their existing session rejected on the next request', async () => {
    const cookie = await login(app, 'dee@x.com', 'her-password');
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(200);
    deactivate();
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });
});

describe('login rate limiting', () => {
  it('returns 429 after 10 attempts per IP in the window', async () => {
    const attempt = () => app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dee@x.com', password: 'wrong' } });
    for (let i = 0; i < 10; i++) {
      const res = await attempt();
      expect(res.statusCode).toBe(401);
    }
    const eleventh = await attempt();
    expect(eleventh.statusCode).toBe(429);
  });
});
