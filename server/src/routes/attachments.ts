import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { requireAuth, canAccessBoard } from '../lib/perms';
import { cards, attachments } from '../db/schema';
import type { AppDeps } from '../app';
import type { AttachmentDto } from '@shared/types';

export function registerAttachmentRoutes(app: FastifyInstance, { db, dataDir, emit }: AppDeps): void {
  app.post('/api/cards/:id/attachments', { preHandler: requireAuth }, async (req, reply) => {
    const cardId = (req.params as { id: string }).id;
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) return reply.code(404).send({ error: 'Card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    if (!req.isMultipart()) return reply.code(400).send({ error: 'Expected multipart upload' });

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const storedName = randomUUID();
    const uploadsDir = path.join(dataDir, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const dest = path.join(uploadsDir, storedName);
    await pipeline(data.file, createWriteStream(dest));

    if (data.file.truncated) {
      await fs.rm(dest, { force: true });
      return reply.code(400).send({ error: 'File exceeds the 20MB limit' });
    }

    const stat = await fs.stat(dest);
    const now = new Date().toISOString();
    const id = nanoid(12);
    db.insert(attachments)
      .values({
        id,
        cardId,
        filename: data.filename,
        storedName,
        sizeBytes: stat.size,
        mime: data.mimetype,
        uploadedBy: req.user.id,
        createdAt: now,
      })
      .run();

    emit.boardChanged(card.boardId, req.user.id);
    const dto: AttachmentDto = {
      id,
      cardId,
      filename: data.filename,
      sizeBytes: stat.size,
      mime: data.mimetype,
      uploadedBy: req.user.id,
      createdAt: now,
    };
    return reply.code(201).send(dto);
  });

  app.get('/api/attachments/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const att = db.select().from(attachments).where(eq(attachments.id, id)).get();
    if (!att) return reply.code(404).send({ error: 'Not found' });
    const card = db.select().from(cards).where(eq(cards.id, att.cardId)).get();
    if (!card || !canAccessBoard(db, req.user.id, card.boardId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const safeName = att.filename.replace(/["\\\r\n]/g, '');
    reply.header('Content-Type', att.mime);
    reply.header('Content-Disposition', `attachment; filename="${safeName}"`);
    return reply.send(createReadStream(path.join(dataDir, 'uploads', att.storedName)));
  });

  app.delete('/api/attachments/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const att = db.select().from(attachments).where(eq(attachments.id, id)).get();
    if (!att) return reply.code(404).send({ error: 'Not found' });
    const card = db.select().from(cards).where(eq(cards.id, att.cardId)).get();
    if (!card || !canAccessBoard(db, req.user.id, card.boardId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    db.delete(attachments).where(eq(attachments.id, id)).run();
    await fs.rm(path.join(dataDir, 'uploads', att.storedName), { force: true });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.code(204).send();
  });
}
