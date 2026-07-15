import { describe, it, expect, beforeEach } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import {
  toMe, toUserPublic, randomAvatarColor, canAccessBoard,
  createSession, revokeSession, revokeUserSessions,
} from '../src/lib/perms.js';
import { LABEL_HEX } from '@shared/types';

type Db = ReturnType<typeof createDb>['db'];

function mkUser(db: Db, over: { id?: string; email?: string; isAdmin?: boolean } = {}) {
  const id = over.id ?? nanoid(12);
  db.insert(schema.users).values({
    id,
    email: over.email ?? `${id}@x.com`,
    name: 'U',
    passwordHash: 'x',
    avatarColor: 'coral',
    isAdmin: over.isAdmin ?? false,
    emailNotifications: true,
    deactivatedAt: null,
    createdAt: new Date().toISOString(),
  }).run();
  return id;
}

function mkBoard(db: Db, over: { visibility: 'team' | 'private'; createdBy: string }) {
  const id = nanoid(12);
  db.insert(schema.boards).values({
    id,
    name: 'B',
    accentColor: 'coral',
    visibility: over.visibility,
    createdBy: over.createdBy,
    archivedAt: null,
    createdAt: new Date().toISOString(),
  }).run();
  return id;
}

let db: Db;
beforeEach(() => { db = createDb(':memory:').db; });

describe('serializers', () => {
  it('toUserPublic omits emailNotifications; toMe includes it', () => {
    const id = mkUser(db, { email: 'a@x.com', isAdmin: true });
    const row = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
    const pub = toUserPublic(row);
    expect(pub).toEqual({ id, name: 'U', email: 'a@x.com', avatarColor: 'coral', isAdmin: true, deactivated: false });
    expect('emailNotifications' in pub).toBe(false);
    expect(toMe(row).emailNotifications).toBe(true);
  });

  it('deactivated maps to true when deactivatedAt set', () => {
    const id = mkUser(db);
    db.update(schema.users).set({ deactivatedAt: new Date().toISOString() }).where(eq(schema.users.id, id)).run();
    const row = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
    expect(toUserPublic(row).deactivated).toBe(true);
  });
});

describe('randomAvatarColor', () => {
  it('returns one of the 8 label color names', () => {
    const names = Object.keys(LABEL_HEX);
    expect(names).toContain(randomAvatarColor());
  });
});

describe('sessions', () => {
  it('createSession inserts a row with a ~30-day future expiry', () => {
    const uid = mkUser(db);
    const token = createSession(db, uid);
    const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, token)).get()!;
    expect(row.userId).toBe(uid);
    expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });

  it('revokeSession deletes one; revokeUserSessions deletes all for a user', () => {
    const uid = mkUser(db);
    const t1 = createSession(db, uid);
    const t2 = createSession(db, uid);
    revokeSession(db, t1);
    expect(db.select().from(schema.sessions).where(eq(schema.sessions.id, t1)).get()).toBeUndefined();
    expect(db.select().from(schema.sessions).where(eq(schema.sessions.id, t2)).get()).toBeDefined();
    revokeUserSessions(db, uid);
    expect(db.select().from(schema.sessions).where(eq(schema.sessions.userId, uid)).all()).toHaveLength(0);
  });
});

describe('canAccessBoard', () => {
  it('returns false for a missing board', () => {
    expect(canAccessBoard(db, mkUser(db), 'nope')).toBe(false);
  });
  it('team board: any user can access', () => {
    const owner = mkUser(db);
    const other = mkUser(db);
    const board = mkBoard(db, { visibility: 'team', createdBy: owner });
    expect(canAccessBoard(db, other, board)).toBe(true);
  });
  it('private board: member yes, non-member no', () => {
    const owner = mkUser(db);
    const member = mkUser(db);
    const stranger = mkUser(db);
    const board = mkBoard(db, { visibility: 'private', createdBy: owner });
    db.insert(schema.boardMembers).values({ boardId: board, userId: member, starred: false }).run();
    expect(canAccessBoard(db, member, board)).toBe(true);
    expect(canAccessBoard(db, stranger, board)).toBe(false);
  });
  it('private board: admin can access without membership', () => {
    const owner = mkUser(db);
    const admin = mkUser(db, { isAdmin: true });
    const board = mkBoard(db, { visibility: 'private', createdBy: owner });
    expect(canAccessBoard(db, admin, board)).toBe(true);
  });
});
