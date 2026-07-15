# Company Trello

A self-hosted, Trello-style kanban board for a small team (2–15 people): shared boards with drag-and-drop cards, live multi-user sync, rich cards (labels, due dates, assignees, checklist, attachments, comments, activity log), @mentions, and notifications. One self-contained service — React 19 + Fastify 5 + Socket.IO + SQLite — deployable from a single Docker image with one mounted volume.

## What's inside

- **Client:** React 19 + TypeScript + Vite + Tailwind v4, TanStack Query, React Router, dnd-kit, socket.io-client.
- **Server:** Node 22 + Fastify 5, Drizzle ORM over better-sqlite3 (WAL), Socket.IO, Zod, bcryptjs.
- **Single process:** in production the server serves the built client, the REST API, and the Socket.IO endpoint on one port; all state (SQLite DB + uploaded attachments) lives under `/data`.

## Local development

Requires Node 22+.

```
npm install
npm run dev     # server on :3000, client on :5173 (proxies /api and /socket.io)
```

Copy `.env.example` to `.env` and set at least `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET`. On first run (empty `users` table) the server creates the admin from those credentials; log in and change the password in Settings.

Other scripts:

```
npm test        # server + client unit tests (Vitest)
npm run e2e     # Playwright end-to-end (builds + starts the real server)
npm run build   # typecheck the server + build client/dist
```

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port the server listens on |
| `DATA_DIR` | no | `./data` | Directory for `app.db`, `uploads/`, `backups/` (baked to `/data` in Docker) |
| `SESSION_SECRET` | yes (prod) | — | Secret for signing session cookies |
| `ADMIN_EMAIL` | first run | — | Bootstrap admin email (used only when `users` is empty) |
| `ADMIN_PASSWORD` | first run | — | Bootstrap admin password (used only when `users` is empty) |
| `APP_URL` | yes (prod) | — | Public base URL, used to build invite / reset links |
| `RESEND_API_KEY` | no | — | Resend API key; if unset, email is skipped and only in-app notifications are sent |
| `EMAIL_FROM` | no | — | From address for notification emails (needed if email is enabled) |
| `BACKUP_S3_ENDPOINT` | no | — | S3-compatible endpoint for off-volume backup upload |
| `BACKUP_S3_BUCKET` | no | — | S3 bucket for nightly backup upload |
| `BACKUP_S3_ACCESS_KEY` | no | — | S3 access key |
| `BACKUP_S3_SECRET_KEY` | no | — | S3 secret key |

Without `RESEND_API_KEY`/`EMAIL_FROM` the app still runs fully — notifications are in-app only and the Admin page shows an "email not configured" notice.

## Deploy to Railway

The app is one Docker image with one persistent volume at `/data`.

1. **Create the service** from this repo (Railway auto-detects the `Dockerfile`).
2. **Add a volume** mounted at `/data`. All data (SQLite DB, attachments, local backups) lives here — without it, every deploy wipes your data.
3. **Set environment variables:**
   - `SESSION_SECRET` — a long random string.
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` — used only on the first boot to create your admin.
   - `APP_URL` — the public URL Railway assigns (e.g. `https://your-app.up.railway.app`).
   - Optional: `RESEND_API_KEY` + `EMAIL_FROM` (email notifications); `BACKUP_S3_*` (off-volume backups).
   - `PORT` is provided by Railway and honored automatically; `DATA_DIR=/data` is baked into the image.
4. **Enable volume snapshots** in the Railway volume settings. This is the required baseline: attachment files are not part of the S3 DB backup, so snapshots are what protect uploads.
5. **Deploy.** Once the image `HEALTHCHECK` (polling `/api/health`) reports healthy, open `APP_URL`, log in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`, change the password in Settings, and invite your team from Admin.

Run anywhere else with Docker:

```
docker build -t company-trello .
docker run -d -p 3000:3000 \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD=change-me \
  -e APP_URL=http://localhost:3000 \
  -v company-trello-data:/data \
  company-trello
```

## Backups & restore

Two layers protect your data:

- **Nightly local backup (automatic):** at 03:00 server time the app copies `app.db` to `/data/backups/` via SQLite's online backup API, keeping the last 14. Recovers from app-level mistakes (e.g. a bad migration).
- **Off-volume copy (recommended):** if `BACKUP_S3_*` are set, the same nightly job uploads the fresh DB backup to your S3-compatible bucket. Attachment files are **not** in this upload — that's why host volume snapshots (deploy step 4) are the required baseline.

**Restore the database from a local backup:**

1. Stop the app (or scale the Railway service to zero) so nothing writes to the DB.
2. Pick a timestamped backup from `/data/backups/`.
3. Replace the live DB and remove stale WAL/SHM sidecars:
   ```
   cp /data/backups/<chosen-backup> /data/app.db
   rm -f /data/app.db-wal /data/app.db-shm
   ```
4. Start the app. It reopens `app.db` and runs any pending migrations.

**Restore from S3:** download the chosen backup object to `/data/app.db` on the volume, then follow steps 3–4 above (removing the WAL/SHM sidecars).

**Restore attachments:** attachment files live under `/data/uploads/`. Recover them from a host volume snapshot; the S3 DB backup does not include them.
