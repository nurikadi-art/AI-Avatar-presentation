import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import * as schema from './db/schema.js';
import { hashPassword } from './lib/passwords.js';
import { randomAvatarColor } from './lib/perms.js';

type Db = BetterSQLite3Database<typeof schema>;

export function firstRunBootstrap(db: Db): void {
  const existing = db.select().from(schema.users).limit(1).get();
  if (existing) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set. ' +
        'Set both to bootstrap the first admin account.',
    );
  }

  db.insert(schema.users).values({
    id: nanoid(12),
    email: email.toLowerCase(),
    name: email.split('@')[0],
    passwordHash: hashPassword(password),
    avatarColor: randomAvatarColor(),
    isAdmin: true,
    emailNotifications: true,
    deactivatedAt: null,
    createdAt: new Date().toISOString(),
  }).run();
}
