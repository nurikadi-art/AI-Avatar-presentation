import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema.js';
import type { Me } from '@shared/types';
import { registerAuthRoutes } from './routes/auth.js';

type Db = BetterSQLite3Database<typeof schema>;

export interface Emit {
  boardChanged(boardId: string, byUserId: string): void;
}

export interface AppDeps {
  db: Db;
  dataDir: string;
  emit: Emit;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    dataDir: string;
    emit: Emit;
  }
  interface FastifyRequest {
    user: Me;
  }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate('db', deps.db);
  app.decorate('dataDir', deps.dataDir);
  app.decorate('emit', deps.emit);

  app.get('/api/health', async () => ({ status: 'ok' }));

  app.register(cookie, { secret: process.env.SESSION_SECRET ?? 'dev-session-secret' });

  // Rate-limit is applied per-route (login). Register it inside an encapsulated
  // plugin and await it so its onRoute hook is active before routes are added.
  app.register(async (instance) => {
    await instance.register(rateLimit, { global: false });
    registerAuthRoutes(instance);
  });

  return app;
}
