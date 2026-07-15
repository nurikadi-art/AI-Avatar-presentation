import type { FastifyInstance } from 'fastify';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import { createDb } from '../src/db/index.js';
import { buildApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { hashPassword } from '../src/lib/passwords.js';

type Db = BetterSQLite3Database<typeof schema>;

export function makeApp(): { app: FastifyInstance; db: Db } {
  const { db } = createDb(':memory:');
  const app = buildApp({ db, dataDir: '/tmp/company-trello-test', emit: { boardChanged: () => {} } });
  return { app, db };
}

export function seedUser(
  db: Db,
  opts: { email: string; name: string; password: string; isAdmin?: boolean },
): { id: string; email: string; name: string; isAdmin: boolean } {
  const id = nanoid(12);
  const email = opts.email.toLowerCase();
  db.insert(schema.users).values({
    id,
    email,
    name: opts.name,
    passwordHash: hashPassword(opts.password),
    avatarColor: 'coral',
    isAdmin: opts.isAdmin ?? false,
    emailNotifications: true,
    deactivatedAt: null,
    createdAt: new Date().toISOString(),
  }).run();
  return { id, email, name: opts.name, isAdmin: opts.isAdmin ?? false };
}

export async function login(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return raw.split(';')[0];
}
