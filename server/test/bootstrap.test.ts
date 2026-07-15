import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { firstRunBootstrap } from '../src/bootstrap.js';
import { verifyPassword } from '../src/lib/passwords.js';

type Db = ReturnType<typeof createDb>['db'];

const saved = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
let db: Db;

beforeEach(() => {
  db = createDb(':memory:').db;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
});
afterEach(() => {
  process.env.ADMIN_EMAIL = saved.email;
  process.env.ADMIN_PASSWORD = saved.password;
  if (saved.email === undefined) delete process.env.ADMIN_EMAIL;
  if (saved.password === undefined) delete process.env.ADMIN_PASSWORD;
});

describe('firstRunBootstrap', () => {
  it('throws when users are empty and env is unset', () => {
    expect(() => firstRunBootstrap(db)).toThrow(/ADMIN_EMAIL/);
  });

  it('creates the admin from env when users are empty', () => {
    process.env.ADMIN_EMAIL = 'Owner@Example.com';
    process.env.ADMIN_PASSWORD = 'sup3r-secret';
    firstRunBootstrap(db);
    const rows = db.select().from(schema.users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('owner@example.com');
    expect(rows[0].isAdmin).toBe(true);
    expect(verifyPassword('sup3r-secret', rows[0].passwordHash)).toBe(true);
  });

  it('is a no-op when at least one user exists', () => {
    db.insert(schema.users).values({
      id: 'existing00001',
      email: 'a@x.com',
      name: 'A',
      passwordHash: 'x',
      avatarColor: 'coral',
      isAdmin: false,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    process.env.ADMIN_EMAIL = 'owner@example.com';
    process.env.ADMIN_PASSWORD = 'sup3r-secret';
    firstRunBootstrap(db);
    expect(db.select().from(schema.users).all()).toHaveLength(1);
  });
});
