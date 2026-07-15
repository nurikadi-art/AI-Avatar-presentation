import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeApp, seedUser, login } from './helpers.js';

let app: FastifyInstance;

beforeEach(() => {
  const ctx = makeApp();
  app = ctx.app;
  seedUser(ctx.db, { email: 'sam@x.com', name: 'Sam', password: 'correct-horse' });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and sets the sid cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'sam@x.com', password: 'correct-horse' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('sam@x.com');
    const setCookie = res.headers['set-cookie'];
    expect(String(setCookie)).toMatch(/sid=/);
    expect(String(setCookie)).toMatch(/HttpOnly/i);
  });

  it('is case-insensitive on the email', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'SAM@x.com', password: 'correct-horse' } });
    expect(res.statusCode).toBe(200);
  });

  it('returns a generic 401 on a wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'sam@x.com', password: 'nope' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid email or password');
  });

  it('returns the same generic 401 for an unknown email', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ghost@x.com', password: 'whatever' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me and logout', () => {
  it('401 without a cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns Me with a valid cookie, then 401 after logout', async () => {
    const cookie = await login(app, 'sam@x.com', 'correct-horse');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().name).toBe('Sam');
    expect(me.json().emailNotifications).toBe(true);

    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(out.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });
});
