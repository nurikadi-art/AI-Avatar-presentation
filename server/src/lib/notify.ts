import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index';
import { notifications, users, cards } from '../db/schema';
import { sendEmail } from './email';
import type { Id, NotificationType } from '@shared/types';

const SUBJECTS: Record<NotificationType, (title: string) => string> = {
  assigned: (t) => `You were assigned to "${t}"`,
  mentioned: (t) => `You were mentioned on "${t}"`,
  due_soon: (t) => `"${t}" is due soon`,
  comment_on_your_card: (t) => `New comment on "${t}"`,
};

export function notify(
  db: Db,
  { userId, type, cardId, actorId }: { userId: Id; type: NotificationType; cardId: Id; actorId: Id | null },
): void {
  db.insert(notifications)
    .values({
      id: nanoid(12),
      userId,
      type,
      cardId,
      actorId,
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    .run();

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.deactivatedAt !== null || !user.emailNotifications) return;

  const card = db
    .select({ title: cards.title, boardId: cards.boardId })
    .from(cards)
    .where(eq(cards.id, cardId))
    .get();
  if (!card) return;

  const subject = SUBJECTS[type](card.title);
  const url = `${process.env.APP_URL ?? ''}/b/${card.boardId}/c/${cardId}`;
  const html = `<p>${subject}</p><p><a href="${url}">Open card</a></p>`;
  void sendEmail({ to: user.email, subject, html });
}
