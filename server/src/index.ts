import { mkdirSync } from 'node:fs';
import { createDb } from './db/index.js';
import { firstRunBootstrap } from './bootstrap.js';
import { buildApp } from './app.js';

const dataDir = process.env.DATA_DIR ?? './data';
mkdirSync(dataDir, { recursive: true });

const { db } = createDb(`${dataDir}/app.db`);
firstRunBootstrap(db);

const app = buildApp({ db, dataDir, emit: { boardChanged: () => {} } });

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  console.error(err);
  process.exit(1);
});
