import { mkdirSync } from 'node:fs';
import { createDb } from './db/index';
import { firstRunBootstrap } from './bootstrap';
import { buildApp } from './app';
import { setupRealtime } from './realtime';
import { startJobs } from './jobs';

const dataDir = process.env.DATA_DIR ?? './data';
mkdirSync(dataDir, { recursive: true });

const { db, sqlite } = createDb(`${dataDir}/app.db`);
firstRunBootstrap(db);

let emitBoardChanged: (boardId: string, byUserId: string) => void = () => {};
const app = buildApp({ db, dataDir, emit: { boardChanged: (b, u) => emitBoardChanged(b, u) } });

const realtime = setupRealtime(app.server, db);
emitBoardChanged = realtime.emitBoardChanged;

startJobs({ db, sqlite, dataDir });

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  console.error(err);
  process.exit(1);
});
