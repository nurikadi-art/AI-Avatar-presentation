import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../lib/perms';
import { users } from '../db/schema';
import { hashPassword, verifyPassword } from '../lib/passwords';
import type { AppDeps } from '../app';
import type { Me } from '@shared/types';

const AVATAR_COLORS = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'] as const;

const patchMeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatarColor: z.enum(AVATAR_COLORS).optional(),
  emailNotifications: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

function toMe(u: {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  isAdmin: boolean;
  emailNotifications: boolean;
  deactivatedAt: string | null;
}): Me {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarColor: u.avatarColor,
    isAdmin: u.isAdmin,
    deactivated: u.deactivatedAt !== null,
    emailNotifications: u.emailNotifications,
  };
}

export function registerUserRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.patch('/api/users/me', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid profile' });

    const updates: Partial<{ name: string; avatarColor: string; emailNotifications: boolean }> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.avatarColor !== undefined) updates.avatarColor = parsed.data.avatarColor;
    if (parsed.data.emailNotifications !== undefined) updates.emailNotifications = parsed.data.emailNotifications;
    if (Object.keys(updates).length) {
      db.update(users).set(updates).where(eq(users.id, req.user.id)).run();
    }

    const u = db.select().from(users).where(eq(users.id, req.user.id)).get()!;
    return reply.send(toMe(u));
  });

  app.post('/api/users/me/password', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid password' });

    const u = db.select().from(users).where(eq(users.id, req.user.id)).get()!;
    const ok = verifyPassword(parsed.data.currentPassword, u.passwordHash);
    if (!ok) return reply.code(400).send({ error: 'Current password is incorrect' });

    const hash = hashPassword(parsed.data.newPassword);
    db.update(users).set({ passwordHash: hash }).where(eq(users.id, req.user.id)).run();
    return reply.code(204).send();
  });
}
