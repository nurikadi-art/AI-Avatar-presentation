import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from '../src/db/index';

const TABLES = [
  'users', 'sessions', 'invites', 'password_resets',
  'boards', 'board_members', 'lists', 'cards',
  'card_assignees', 'labels', 'card_labels', 'checklist_items',
  'comments', 'attachments', 'activity', 'notifications',
];

describe('createDb', () => {
  it('creates every table from the migrations', () => {
    const { sqlite } = createDb(':memory:');
    const names = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    for (const t of TABLES) expect(names).toContain(t);
    sqlite.close();
  });

  it('enables foreign key enforcement', () => {
    const { sqlite } = createDb(':memory:');
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    sqlite.close();
  });

  it('uses WAL journal mode for file-backed databases', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trello-db-'));
    const { sqlite } = createDb(join(dir, 'app.db'));
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
