import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Me } from '@shared/types';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBoardRoutes } from './routes/boards';
import { registerListRoutes } from './routes/lists';
import { registerCardRoutes } from './routes/cards';
import type { Db } from './db/index.js';

export interface Emit {
  boardChanged(boardId: string, byUserId: string): void;
}

export interface AppDeps {
  db: Db;
  dataDir: string;
  emit: Emit;
}

export type RouteCtx = AppDeps;

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

  const ctx: RouteCtx = { db: deps.db, dataDir: deps.dataDir, emit: deps.emit };
  registerBoardRoutes(app, ctx);
  registerListRoutes(app, ctx);
  registerCardRoutes(app, ctx);

  return app;
}
