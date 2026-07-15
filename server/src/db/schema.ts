import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarColor: text('avatar_color').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).notNull().default(true),
  deactivatedAt: text('deactivated_at'),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
});

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
});

export const passwordResets = sqliteTable('password_resets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
});

export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  accentColor: text('accent_color').notNull(),
  visibility: text('visibility', { enum: ['team', 'private'] }).notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});

export const boardMembers = sqliteTable(
  'board_members',
  {
    boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id),
    starred: integer('starred', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.userId] })],
);

export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: text('position').notNull(),
  archivedAt: text('archived_at'),
});

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  listId: text('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  dueDate: text('due_date'),
  position: text('position').notNull(),
  archivedAt: text('archived_at'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const cardAssignees = sqliteTable(
  'card_assignees',
  {
    cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] })],
);

export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default(''),
  color: text('color').notNull(),
});

export const cardLabels = sqliteTable(
  'card_labels',
  {
    cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    labelId: text('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);

export const checklistItems = sqliteTable('checklist_items', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  position: text('position').notNull(),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
});

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  storedName: text('stored_name').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  mime: text('mime').notNull(),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  cardId: text('card_id').references(() => cards.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  data: text('data').notNull(),
  createdAt: text('created_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => users.id),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
});
