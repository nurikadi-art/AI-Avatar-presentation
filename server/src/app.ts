import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Me } from '@shared/types';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBoardRoutes } from './routes/boards';
import { registerListRoutes } from './routes/lists';
import { registerCardRoutes } from './routes/cards';
import { registerCommentRoutes } from './routes/comments';
import { registerAttachmentRoutes } from './routes/attachments';
import { registerSearchRoutes } from './routes/search';
import { registerNotificationRoutes } from './routes/notifications';
import { registerUserRoutes } from './routes/users';
import { registerAdminRoutes } from './routes/admin';
import type { Db } from './db/index.js';

const clientDist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');

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

  app.register(async (instance) => {
    await instance.register(rateLimit, { global: false });
    registerAuthRoutes(instance);
  });

  const ctx: RouteCtx = { db: deps.db, dataDir: deps.dataDir, emit: deps.emit };
  registerBoardRoutes(app, ctx);
  registerListRoutes(app, ctx);
  registerCardRoutes(app, ctx);

  app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 }, throwFileSizeLimit: false });
  registerCommentRoutes(app, ctx);
  registerAttachmentRoutes(app, ctx);
  registerSearchRoutes(app, ctx);
  registerNotificationRoutes(app, ctx);
  registerUserRoutes(app, ctx);
  registerAdminRoutes(app, ctx);

  if (existsSync(clientDist)) {
    app.register(fastifyStatic, { root: clientDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api')) {
        reply.code(404).send({ error: 'Not found' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}
