import path from 'node:path';
import { promises as fs } from 'node:fs';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import type { Db } from './db/index';
import { cards, cardAssignees, notifications } from './db/schema';
import { notify } from './lib/notify';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function runDueSoon(db: Db, now: Date = new Date()): void {
  const todayStr = toDateStr(now);
  const tomorrowStr = toDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const due = db
    .select()
    .from(cards)
    .where(and(isNull(cards.archivedAt), inArray(cards.dueDate, [todayStr, tomorrowStr])))
    .all();

  for (const card of due) {
    const assignees = db
      .select({ userId: cardAssignees.userId })
      .from(cardAssignees)
      .where(eq(cardAssignees.cardId, card.id))
      .all()
      .map((a) => a.userId);
    const recipients = assignees.length ? assignees : [card.createdBy];
    for (const userId of recipients) {
      const already = db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.cardId, card.id),
          eq(notifications.type, 'due_soon'),
        ))
        .get();
      if (already) continue;
      notify(db, { userId, type: 'due_soon', cardId: card.id, actorId: null });
    }
  }
}

type SqliteBackup = { backup(destination: string): Promise<unknown> };

async function maybeUploadToS3(filePath: string, key: string): Promise<void> {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return;
  try {
    const { AwsClient } = await import('aws4fetch');
    const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3' });
    const body = await fs.readFile(filePath);
    const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    const res = await client.fetch(url, { method: 'PUT', body });
    if (!res.ok) console.error(`[backup] S3 upload failed: ${res.status}`);
  } catch (err) {
    console.error('[backup] S3 upload error', err);
  }
}

export async function runBackup(sqlite: SqliteBackup, dataDir: string, now: Date = new Date()): Promise<string> {
  const backupsDir = path.join(dataDir, 'backups');
  await fs.mkdir(backupsDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupsDir, `app-${stamp}.db`);
  await sqlite.backup(dest);

  const files = (await fs.readdir(backupsDir))
    .filter((f) => f.startsWith('app-') && f.endsWith('.db'))
    .sort();
  const excess = files.length - 14;
  for (let i = 0; i < excess; i++) {
    await fs.rm(path.join(backupsDir, files[i]), { force: true });
  }

  await maybeUploadToS3(dest, path.basename(dest));
  return dest;
}

function msUntilNext(now: Date, hour: number, minute: number): number {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleDaily(hour: number, minute: number, run: () => void): void {
  const arm = (): void => {
    setTimeout(() => {
      try {
        run();
      } catch (err) {
        console.error('[jobs] scheduled run failed', err);
      }
      arm();
    }, msUntilNext(new Date(), hour, minute)).unref();
  };
  arm();
}

export function startJobs(deps: { db: Db; sqlite: SqliteBackup; dataDir: string }): void {
  scheduleDaily(9, 0, () => runDueSoon(deps.db));
  scheduleDaily(3, 0, () => {
    void runBackup(deps.sqlite, deps.dataDir);
  });
}
