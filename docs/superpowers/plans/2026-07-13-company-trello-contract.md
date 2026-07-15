# Company Trello — Implementation Contract

Shared conventions every plan section and implementation task MUST follow exactly. The spec is at `docs/superpowers/specs/2026-07-13-company-trello-design.md`. Where this contract pins a name or shape, use it verbatim — do not invent variants.

## Repo layout (npm workspaces)

```
package.json            # workspaces: ["client", "server"]; scripts: dev, build, test, e2e
tsconfig.base.json
Dockerfile              # multi-stage: build client+server, run server serving client/dist
.dockerignore  .gitignore  .env.example  README.md
shared/types.ts         # ALL API DTO types (single source of truth, given in full below)
e2e/                    # Playwright specs
playwright.config.ts
client/                 # React 19 + TS + Vite + Tailwind v4
server/                 # Node 22 + Fastify 5 + TS
```

- Path alias `@shared/types` → `shared/types.ts` in both client (vite + tsconfig) and server (tsconfig paths + tsx).
- Server workspace scripts: `dev` (tsx watch src/index.ts), `test` (vitest run), `build` (tsc). Client: `dev`, `build` (tsc -b && vite build), `test` (vitest run).
- Root scripts: `dev` (concurrently both), `test` (`npm test -w server && npm test -w client`), `e2e` (`playwright test`).

## Server layout

```
server/src/index.ts        # entry: createDb → migrate → bootstrap → buildApp → realtime → jobs → listen
server/src/app.ts          # buildApp({db, dataDir, emit}): FastifyInstance; registers all routes; test entrypoint
server/src/db/schema.ts    # Drizzle schema (below)
server/src/db/index.ts     # createDb(path | ':memory:') → { db, sqlite }; runs migrations programmatically
server/src/bootstrap.ts    # firstRunBootstrap(db): create admin from ADMIN_EMAIL/ADMIN_PASSWORD if users empty; throw if empty+unset
server/src/lib/position.ts # positionBetween(a: string|null, b: string|null): string  (fractional-indexing pkg + 2-char random jitter suffix)
server/src/lib/passwords.ts# hashPassword/verifyPassword (bcryptjs, cost 12)
server/src/lib/email.ts    # sendEmail({to, subject, html}): fetch POST https://api.resend.com/emails; no-op + log if RESEND_API_KEY unset; never throws
server/src/lib/activity.ts # logActivity(db, {boardId, cardId?, actorId, type, data})
server/src/lib/notify.ts   # notify(db, {userId, type, cardId, actorId}) → insert row + fire-and-forget email
server/src/lib/perms.ts    # canAccessBoard(db, userId, boardId), requireAuth, requireAdmin (Fastify preHandlers); req.user = Me
server/src/routes/{auth,users,boards,lists,cards,comments,attachments,search,notifications,admin}.ts
server/src/realtime.ts     # setupRealtime(server, db) → { emitBoardChanged(boardId, byUserId) }; rooms `board:{id}`
server/src/jobs.ts         # startJobs(db): dueSoon daily 09:00 server time; backup nightly 03:00 (+ optional S3 PUT)
server/test/helpers.ts     # makeApp() → {app, db}; seedUser(db, {email,name,password,isAdmin}) → user; login(app, email, password) → cookie
server/test/*.test.ts
server/drizzle/            # generated migrations (drizzle-kit)
```

## Database schema (Drizzle, SQLite WAL, exact names)

Conventions: ids `text` = `nanoid(12)`; timestamps `text` ISO-8601 UTC (`new Date().toISOString()`); `due_date` is **date-only** `text` 'YYYY-MM-DD'; booleans `integer({ mode: 'boolean' })`; positions `text` (fractional index). TS variable names camelCase, SQL names snake_case.

- `users`: id, email (unique), name, password_hash, avatar_color, is_admin, email_notifications (default true), deactivated_at (null), created_at
- `sessions`: id (32-byte hex token), user_id, expires_at  — 30-day sliding
- `invites`: id (token), email, invited_by, expires_at (7d), used_at
- `password_resets`: id (token), user_id, expires_at (1h), used_at
- `boards`: id, name, accent_color (LabelColor name), visibility ('team'|'private'), created_by, archived_at, created_at
- `board_members`: board_id, user_id, starred (default false) — PK (board_id, user_id)
- `lists`: id, board_id, name, position, archived_at
- `cards`: id, list_id, board_id, title, description (default ''), due_date (null), position, archived_at, created_by, created_at, updated_at
- `card_assignees`: card_id, user_id — PK pair
- `labels`: id, board_id, name (default ''), color
- `card_labels`: card_id, label_id — PK pair
- `checklist_items`: id, card_id, text, done (default false), position
- `comments`: id, card_id, author_id, body, created_at
- `attachments`: id, card_id, filename, stored_name, size_bytes, mime, uploaded_by, created_at
- `activity`: id, board_id, card_id (null), actor_id, type, data (text JSON), created_at
- `notifications`: id, user_id, type, card_id, actor_id (null), read_at (null), created_at

Board creation auto-seeds 8 labels (one per color, name ''). Deleting a label deletes its card_labels rows. Card/list ordering: always ORDER BY (position, id).

## shared/types.ts (complete file — copy verbatim in the scaffold task)

```ts
export type Id = string;
export type LabelColor = 'coral' | 'amber' | 'olive' | 'teal' | 'blue' | 'purple' | 'pink' | 'gray';
export type Visibility = 'team' | 'private';
export type NotificationType = 'assigned' | 'mentioned' | 'due_soon' | 'comment_on_your_card';

export interface UserPublic { id: Id; name: string; email: string; avatarColor: string; isAdmin: boolean; deactivated: boolean; }
export interface Me extends UserPublic { emailNotifications: boolean; }
export interface BoardSummary { id: Id; name: string; accentColor: LabelColor; visibility: Visibility; starred: boolean; cardCount: number; memberCount: number; archivedAt: string | null; }
export interface Label { id: Id; boardId: Id; name: string; color: LabelColor; }
export interface ListDto { id: Id; boardId: Id; name: string; position: string; archivedAt: string | null; }
export interface ChecklistItemDto { id: Id; cardId: Id; text: string; done: boolean; position: string; }
export interface CardDto { id: Id; listId: Id; boardId: Id; title: string; description: string; dueDate: string | null; position: string; archivedAt: string | null; createdBy: Id; createdAt: string; updatedAt: string; assigneeIds: Id[]; labelIds: Id[]; checklist: ChecklistItemDto[]; attachmentCount: number; commentCount: number; }
export interface BoardDetail { board: BoardSummary & { members: UserPublic[] }; lists: ListDto[]; cards: CardDto[]; labels: Label[]; }
export interface CommentDto { id: Id; cardId: Id; authorId: Id; body: string; createdAt: string; }
export interface AttachmentDto { id: Id; cardId: Id; filename: string; sizeBytes: number; mime: string; uploadedBy: Id; createdAt: string; }
export interface ActivityDto { id: Id; boardId: Id; cardId: Id | null; actorId: Id; type: string; data: Record<string, unknown>; createdAt: string; }
export interface NotificationDto { id: Id; type: NotificationType; cardId: Id; cardTitle: string; boardId: Id; actorId: Id | null; actorName: string | null; readAt: string | null; createdAt: string; }
export interface SearchResult { cardId: Id; boardId: Id; title: string; boardName: string; listName: string; }
export interface BoardChangedEvent { boardId: Id; byUserId: Id; }
export interface PresenceEvent { boardId: Id; users: { id: Id; name: string; avatarColor: string }[]; }
export const LABEL_HEX: Record<LabelColor, string> = { coral: '#D85A30', amber: '#EF9F27', olive: '#639922', teal: '#1D9E75', blue: '#378ADD', purple: '#7F77DD', pink: '#D4537E', gray: '#888780' };
```

## REST API (all under /api, JSON, cookie auth; Zod-validate every body; errors `{ error: string }`)

| Route | Auth | Notes |
|---|---|---|
| POST /api/auth/login {email,password} | public | rate-limited 10/min/IP; sets `sid` cookie; → Me |
| POST /api/auth/logout | user | clears session |
| GET /api/auth/me | user | → Me |
| POST /api/auth/accept-invite {token,name,password} | public | → Me + session |
| POST /api/auth/reset-password {token,password} | public | consumes password_resets; revokes user sessions; → Me + session |
| GET /api/boards | user | → BoardSummary[] (visible, non-archived) |
| POST /api/boards {name,visibility,accentColor} | user | seeds 8 labels; creator becomes board_member; → BoardDetail |
| GET /api/boards/:id | user+access | → BoardDetail (non-archived lists/cards) |
| PATCH /api/boards/:id {name?,visibility?,accentColor?} | user+access | |
| DELETE /api/boards/:id | user+access | archive |
| POST /api/boards/:id/star {starred} | user+access | upserts board_members row |
| POST /api/boards/:id/members {userId} / DELETE .../members/:userId | user+access | |
| GET /api/boards/:id/archived | user+access | → {lists, cards} archived; POST /api/boards/:id/restore {entity,id} |
| POST /api/boards/:id/labels {name,color} · PATCH/DELETE /api/labels/:id | user+access | |
| POST /api/boards/:id/lists {name} | user+access | position = end |
| PATCH /api/lists/:id {name?,position?} · DELETE (archive) | user+access | |
| POST /api/lists/:id/cards {title} | user+access | → CardDto; position = end |
| GET /api/cards/:id | user+access | → CardDto & {comments, attachments, activity} |
| PATCH /api/cards/:id {title?,description?,dueDate?,listId?,position?} | user+access | move = listId+position |
| DELETE /api/cards/:id | user+access | archive |
| POST/DELETE /api/cards/:id/assignees(/:userId) {userId} | user+access | POST notifies 'assigned' |
| POST/DELETE /api/cards/:id/labels(/:labelId) {labelId} | user+access | |
| POST /api/cards/:id/checklist {text} · PATCH/DELETE /api/checklist/:id {text?,done?,position?} | user+access | |
| POST /api/cards/:id/comments {body} | user+access | mentions `@[userId]` → notify 'mentioned'; card creator/assignees → 'comment_on_your_card' |
| POST /api/cards/:id/attachments (multipart, ≤20MB) · GET/DELETE /api/attachments/:id | user+access | GET streams file, Content-Disposition: attachment |
| GET /api/search?q= | user | → SearchResult[] (title+description LIKE, accessible boards, ≤20) |
| GET /api/notifications | user | → NotificationDto[] (latest 50) · POST /api/notifications/read {ids?} (omit = all) |
| PATCH /api/users/me {name?,avatarColor?,emailNotifications?} | user | |
| POST /api/users/me/password {currentPassword,newPassword} | user | |
| POST /api/admin/invites {email} | admin | existing active email → issues password reset instead; → {link} |
| GET /api/admin/members | admin | → { members: UserPublic[], diskUsageBytes: number, emailConfigured: boolean } (members incl. deactivated; emailConfigured = RESEND_API_KEY && EMAIL_FROM set) |
| GET /api/admin/archived-boards | admin | → BoardSummary[] (boards with archived_at != null) |
| POST /api/admin/restore {entity:'board', id} | admin | un-archives a board (symmetric with purge) |
| PATCH /api/admin/members/:id {deactivated?,isAdmin?} | admin | deactivate revokes sessions |
| POST /api/admin/members/:id/reset-password | admin | → {link}; revokes sessions |
| POST /api/admin/purge {entity,id} | admin | permanent delete of archived item (cascade files) |

Every successful mutation on board content calls `emit.boardChanged(boardId, req.user.id)`.

## Socket.IO contract

- Handshake authenticated via the `sid` cookie. Client emits `board:join` / `board:leave` with `{boardId}` (server verifies access before joining room `board:{id}`).
- Server → clients: `board:changed` (BoardChangedEvent), `board:presence` (PresenceEvent, on join/leave).
- Client on `board:changed`: invalidate `['board', boardId]` query, debounced 150 ms. On reconnect: refetch board + show/hide reconnecting banner. While disconnected: disable mutations + drag.

## Client layout

```
client/src/main.tsx  App.tsx            # Router: /login /invite/:token /reset/:token / /b/:boardId /b/:boardId/c/:cardId /admin /settings
client/src/index.css                    # Tailwind v4 @theme tokens (below)
client/src/api/client.ts                # api<T>(path, opts): fetch wrapper, JSON, throws ApiError{status,message}
client/src/api/queries.ts               # query keys: ['me'] ['boards'] ['board', id] ['card', id] ['notifications'] ['search', q]; typed hooks
client/src/api/socket.ts                # getSocket(), useBoardChannel(boardId) hook (join/leave, invalidate, presence, connected state)
client/src/lib/position.ts              # positionBetween(a, b) — fractional-indexing, no jitter client-side
client/src/pages/{LoginPage,AcceptInvitePage,ResetPasswordPage,HomePage,BoardPage,AdminPage,SettingsPage}.tsx
client/src/components/AppShell.tsx      # header: logo/home link, search, NotificationsBell, avatar menu
client/src/components/ui/{Button,Dialog,Input,Avatar,Toast,Menu}.tsx   # small, hand-rolled, warm-styled
client/src/components/NotificationsBell.tsx
client/src/components/board/{BoardHeader,ListColumn,CardTile,CardComposer,BoardMenu}.tsx
client/src/components/card/{CardDetail,LabelPicker,DueDatePicker,AssigneePicker,Checklist,Attachments,Comments,ActivityLog}.tsx
```

- Drag & drop: `@dnd-kit/core` + `@dnd-kit/sortable` (cards sortable within/between list columns; lists sortable horizontally). On drop: compute `positionBetween(prev, next)`, optimistic cache update, PATCH; on error → invalidate + toast.
- Avatars: initials (first letters of name words, max 2) on `avatarColor` (a LABEL_HEX color name) circle.

## Tailwind v4 theme (client/src/index.css)

```css
@import "tailwindcss";
@theme {
  --color-cream: #FBF5EC;   /* page background */
  --color-paper: #FFFDFA;   /* cards / surfaces */
  --color-sand:  #EADFCE;   /* hairline borders */
  --color-ink:   #4A1B0C;   /* primary text */
  --color-rust:  #993C1D;   /* secondary text / accents */
  --color-latte: #B8865B;   /* muted text */
  --color-coral: #D85A30;   /* primary action */
  --color-sun:   #EF9F27;   /* highlights */
}
```

Look: cream page bg, paper cards, 1px sand borders, 8–10px radii, no heavy shadows, generous whitespace, rust/coral accents. Overdue due-date chip: `bg-red-100 text-red-800`.

## Testing conventions

- Server: Vitest; `makeApp()` uses `createDb(':memory:')` with migrations applied; requests via `app.inject({method, url, payload, headers: {cookie}})`. Write the failing test first, run it, implement, re-run (TDD).
- Client: Vitest + @testing-library/react for non-trivial logic (position math, useBoardChannel, optimistic move reducer). Simple presentational components are covered by E2E, not unit tests.
- E2E: Playwright against the real built app (server on a temp DATA_DIR, seeded admin via env). Critical journey incl. a second browser context asserting live sync.

## Env vars

`PORT` (3000) · `DATA_DIR` (./data) · `SESSION_SECRET` (required in prod) · `ADMIN_EMAIL`/`ADMIN_PASSWORD` (first-run bootstrap) · `RESEND_API_KEY`/`EMAIL_FROM` (email; optional in dev) · `BACKUP_S3_ENDPOINT`/`BACKUP_S3_BUCKET`/`BACKUP_S3_ACCESS_KEY`/`BACKUP_S3_SECRET_KEY` (optional) · `APP_URL` (for links in emails/invite links)

## Conventions

- Commit after every green test (small commits, `feat:`/`test:`/`chore:` prefixes, end body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).
- Zod schemas colocated in route files. No `any`. No comments explaining the obvious.
- Package majors: react ^19, react-router ^7, @tanstack/react-query ^5, fastify ^5, socket.io ^4, drizzle-orm latest, better-sqlite3 latest, tailwindcss ^4, vite ^7, vitest ^3, playwright ^1, zod ^3, bcryptjs ^3, nanoid ^5, fractional-indexing ^3.
