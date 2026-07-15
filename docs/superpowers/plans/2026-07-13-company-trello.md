# Company Trello Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained Trello-style kanban app for a 2–15 person team: boards, lists, drag-and-drop cards, rich card details, live sync, notifications, invite-only auth, warm minimal UI.

**Architecture:** One deployable service — a Fastify (Node 22) server exposing a REST API + Socket.IO realtime, serving a built React 19 SPA, with SQLite (Drizzle) and on-disk attachments on a single volume. Deployed as a Docker image (Railway target).

**Tech Stack:** React 19 + Vite + Tailwind v4 + TanStack Query + dnd-kit + socket.io-client · Fastify 5 + Socket.IO + Drizzle/better-sqlite3 + Zod · Vitest + Playwright.

**Binding references:** the spec (`docs/superpowers/specs/2026-07-13-company-trello-design.md`) defines WHAT; the contract (`docs/superpowers/plans/2026-07-13-company-trello-contract.md`) pins names/shapes/layout and WINS over any conflicting text in a task. Sections execute in order 1→12; tasks within a section in order.

---

## Section 1: Project scaffolding

Sets up the npm-workspaces monorepo, the shared DTO types, a minimal Fastify server (only `GET /api/health` + SPA static serving of `client/dist`), a minimal Vite/React/Tailwind-v4 client rendering "company trello", Vitest smoke tests in both workspaces, a Playwright config whose `webServer` builds and starts the real server, root scripts, and a multi-stage Dockerfile. Everything downstream (DB, auth, boards, realtime, jobs, full client) is built by later sections onto this skeleton.

**Boundary note:** `buildApp()` is intentionally no-arg here. Sections 2–3 will widen its signature to `buildApp({ db, dataDir, emit })` and expand `server/src/index.ts` to `createDb → migrate → bootstrap → buildApp → realtime → jobs → listen`, and will add the full `server/test/helpers.ts` (`makeApp`, `seedUser`, `login`). Do **not** create DB schema, migrations, `position.ts`, or DTO type definitions here — `shared/types.ts` is copied verbatim and imported, never redefined.

### Files

**Create**
- `package.json` — root, npm workspaces + scripts
- `tsconfig.base.json` — shared TS compiler options
- `.gitignore`
- `.dockerignore`
- `.env.example`
- `README.md` — stub
- `Dockerfile` — multi-stage
- `playwright.config.ts`
- `shared/types.ts` — verbatim from contract
- `server/package.json`
- `server/tsconfig.json`
- `server/vitest.config.ts`
- `server/src/app.ts` — `buildApp()`
- `server/src/index.ts` — entry
- `client/package.json`
- `client/tsconfig.json`
- `client/tsconfig.app.json`
- `client/tsconfig.node.json`
- `client/vite.config.ts`
- `client/index.html`
- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/index.css` — Tailwind v4 `@theme`
- `client/src/test/setup.ts`

**Test**
- `server/test/health.test.ts`
- `client/src/App.test.tsx`
- `e2e/smoke.spec.ts`

**Modify**
- none

---

### Task 1.1: Root workspace + shared types

**Files:** `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `README.md`, `shared/types.ts`

- [ ] **Step 1: Init git and root `package.json`.** Run `git init` in the repo root, then create `package.json`:
  ```json
  {
    "name": "company-trello",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "workspaces": ["client", "server"],
    "scripts": {
      "dev": "concurrently -n server,client -c blue,magenta \"npm run dev -w server\" \"npm run dev -w client\"",
      "build": "npm run build -w server && npm run build -w client",
      "test": "npm test -w server && npm test -w client",
      "e2e": "playwright test"
    },
    "devDependencies": {
      "@playwright/test": "^1.49.0",
      "@types/node": "^22.10.0",
      "concurrently": "^9.1.0",
      "typescript": "^5.7.2"
    }
  }
  ```

- [ ] **Step 2: Create `tsconfig.base.json`.** Shared compiler options; both workspaces extend this.
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "lib": ["ES2022"],
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "isolatedModules": true,
      "moduleDetection": "force",
      "resolveJsonModule": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true,
      "noEmit": true
    }
  }
  ```

- [ ] **Step 3: Create `.gitignore`.**
  ```gitignore
  node_modules/
  node_modules/.tmp/
  dist/
  client/dist/
  server/dist/
  data/
  e2e/.data/
  playwright-report/
  test-results/
  *.log
  .env
  .DS_Store
  ```

- [ ] **Step 4: Create `.env.example`** (all env vars from the contract; secrets blank):
  ```dotenv
  PORT=3000
  DATA_DIR=./data
  SESSION_SECRET=change-me-in-production
  ADMIN_EMAIL=admin@example.com
  ADMIN_PASSWORD=change-me
  RESEND_API_KEY=
  EMAIL_FROM=
  APP_URL=http://localhost:5173
  BACKUP_S3_ENDPOINT=
  BACKUP_S3_BUCKET=
  BACKUP_S3_ACCESS_KEY=
  BACKUP_S3_SECRET_KEY=
  ```

- [ ] **Step 5: Create `README.md` stub** (section 12 finalizes it):
  ```markdown
  # company trello

  Self-hosted Trello-style kanban for a small team. Single service: React 19 + Fastify 5 + Socket.IO + SQLite.

  ## Development

  ```
  npm install
  npm run dev        # client on :5173 (proxies /api), server on :3000
  npm test           # server + client unit tests
  npm run e2e        # Playwright end-to-end (builds + starts the real server)
  ```

  ## Environment

  Copy `.env.example` to `.env` and fill in values. Full contract:
  `docs/superpowers/plans/2026-07-13-company-trello-contract.md`.

  ## Production

  ```
  docker build -t company-trello .
  docker run -p 3000:3000 -v "$(pwd)/data:/data" --env-file .env company-trello
  ```
  ```

- [ ] **Step 6: Create `shared/types.ts`** — copy the contract's file **verbatim**:
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

- [ ] **Step 7: Install root dev deps.** Run `npm install` (workspaces `client`/`server` don't exist yet, so npm installs only the root devDependencies and writes `package-lock.json`).
  - Expected: `added 4 packages` (plus their transitive deps) and a new `package-lock.json`. No error about missing workspaces.

- [ ] **Step 8: Commit.**
  ```
  git add -A && git commit -m "chore: root npm workspace scaffolding and shared types" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 1.2: Server skeleton (TDD)

**Files:** `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/test/health.test.ts`, `server/src/app.ts`, `server/src/index.ts`

- [ ] **Step 1: Create `server/package.json`.**
  ```json
  {
    "name": "server",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "tsx watch src/index.ts",
      "build": "tsc",
      "start": "tsx src/index.ts",
      "test": "vitest run"
    },
    "dependencies": {
      "@fastify/static": "^8.0.0",
      "fastify": "^5.2.0"
    },
    "devDependencies": {
      "@types/node": "^22.10.0",
      "tsx": "^4.19.2",
      "vitest": "^3.0.0"
    }
  }
  ```

- [ ] **Step 2: Create `server/tsconfig.json`** (extends base; adds the `@shared/types` path alias and node types; typecheck-only via inherited `noEmit`).
  ```json
  {
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@shared/types": ["../shared/types.ts"]
      },
      "types": ["node"]
    },
    "include": ["src", "test", "vitest.config.ts"]
  }
  ```

- [ ] **Step 3: Create `server/vitest.config.ts`** (node env; resolves `@shared/types` for later sections).
  ```ts
  import { defineConfig } from 'vitest/config';
  import { fileURLToPath } from 'node:url';

  export default defineConfig({
    resolve: {
      alias: {
        '@shared/types': fileURLToPath(new URL('../shared/types.ts', import.meta.url)),
      },
    },
    test: {
      environment: 'node',
    },
  });
  ```

- [ ] **Step 4: Install & link the server workspace.** Run `npm install`.
  - Expected: installs `fastify`, `@fastify/static`, `tsx`, `vitest`; `node_modules/server` symlink created. Ends `added N packages`, no errors.

- [ ] **Step 5: Write the failing smoke test** `server/test/health.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { buildApp } from '../src/app';

  describe('GET /api/health', () => {
    it('returns { status: "ok" }', async () => {
      const app = buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
      await app.close();
    });
  });
  ```

- [ ] **Step 6: Run the test — expect failure.** `npm test -w server`
  - Expected: FAIL — Vitest cannot resolve `../src/app` (`Failed to load url ../src/app` / module not found). `Test Files 1 failed`.

- [ ] **Step 7: Implement `server/src/app.ts`.** Minimal Fastify app: `GET /api/health` always; when a built `client/dist` exists, serve it as static files with an SPA fallback for non-`/api` routes.
  ```ts
  import Fastify from 'fastify';
  import type { FastifyInstance } from 'fastify';
  import fastifyStatic from '@fastify/static';
  import { existsSync } from 'node:fs';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';

  const clientDist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');

  export function buildApp(): FastifyInstance {
    const app = Fastify({ logger: false });

    app.get('/api/health', async () => ({ status: 'ok' }));

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
  ```

- [ ] **Step 8: Implement `server/src/index.ts`.** Boot `buildApp()` and listen on `PORT` (default 3000), bind `0.0.0.0` for Docker.
  ```ts
  import { buildApp } from './app';

  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);

  app
    .listen({ port, host: '0.0.0.0' })
    .then((address) => {
      console.log(`server listening on ${address}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
  ```

- [ ] **Step 9: Run the test — expect pass.** `npm test -w server`
  - Expected: `Test Files 1 passed (1)` · `Tests 1 passed (1)`.

- [ ] **Step 10: Typecheck the server.** `npm run build -w server`
  - Expected: `tsc` completes with no output and exit code 0 (no type errors; `noEmit`, so no files written).

- [ ] **Step 11: Commit.**
  ```
  git add -A && git commit -m "feat: minimal fastify server with /api/health and SPA static serving" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 1.3: Client skeleton (TDD)

**Files:** `client/package.json`, `client/tsconfig.json`, `client/tsconfig.app.json`, `client/tsconfig.node.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/index.css`, `client/src/test/setup.ts`, `client/src/App.test.tsx`, `client/src/App.tsx`

- [ ] **Step 1: Create `client/package.json`** (only the deps section 1 needs; router/query/dnd-kit/socket.io-client are added by client sections 8–11).
  ```json
  {
    "name": "client",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "preview": "vite preview",
      "test": "vitest run"
    },
    "dependencies": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    },
    "devDependencies": {
      "@tailwindcss/vite": "^4.0.0",
      "@testing-library/jest-dom": "^6.6.3",
      "@testing-library/react": "^16.1.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.3.4",
      "jsdom": "^25.0.1",
      "tailwindcss": "^4.0.0",
      "vite": "^7.0.0",
      "vitest": "^3.0.0"
    }
  }
  ```

- [ ] **Step 2: Create `client/tsconfig.json`** (solution config with references — matches the Vite react-ts layout `tsc -b` expects).
  ```json
  {
    "files": [],
    "references": [
      { "path": "./tsconfig.app.json" },
      { "path": "./tsconfig.node.json" }
    ]
  }
  ```

- [ ] **Step 3: Create `client/tsconfig.app.json`** (app sources; DOM libs, React JSX, `@shared/types` alias, Vitest + jest-dom global types).
  ```json
  {
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
      "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "jsx": "react-jsx",
      "useDefineForClassFields": true,
      "allowImportingTsExtensions": true,
      "baseUrl": ".",
      "paths": {
        "@shared/types": ["../shared/types.ts"]
      },
      "types": ["vitest/globals", "@testing-library/jest-dom"]
    },
    "include": ["src"]
  }
  ```

- [ ] **Step 4: Create `client/tsconfig.node.json`** (typechecks `vite.config.ts`).
  ```json
  {
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
      "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
      "lib": ["ES2022"],
      "types": ["node"]
    },
    "include": ["vite.config.ts"]
  }
  ```

- [ ] **Step 5: Create `client/vite.config.ts`** (React + Tailwind v4 plugins, `@shared/types` alias, `/api` dev proxy to the server, Vitest jsdom config).
  ```ts
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';
  import { fileURLToPath } from 'node:url';

  export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@shared/types': fileURLToPath(new URL('../shared/types.ts', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  });
  ```

- [ ] **Step 6: Create `client/index.html`** (Vite entry HTML).
  ```html
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>company trello</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Step 7: Create `client/src/index.css`** — Tailwind v4 import + the `@theme` tokens (verbatim from contract).
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

- [ ] **Step 8: Create `client/src/main.tsx`** (React root; imports the theme CSS).
  ```tsx
  import { StrictMode } from 'react';
  import { createRoot } from 'react-dom/client';
  import App from './App';
  import './index.css';

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  ```

- [ ] **Step 9: Create `client/src/test/setup.ts`** (jest-dom matchers for Vitest).
  ```ts
  import '@testing-library/jest-dom';
  ```

- [ ] **Step 10: Install & link the client workspace.** Run `npm install`.
  - Expected: installs `react`, `react-dom`, `vite`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, testing-library, `jsdom`; `node_modules/client` symlink created. Ends `added N packages`, no errors.

- [ ] **Step 11: Write the failing component test** `client/src/App.test.tsx`:
  ```tsx
  import { render, screen } from '@testing-library/react';
  import App from './App';

  test('renders the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /company trello/i })).toBeInTheDocument();
  });
  ```

- [ ] **Step 12: Run the test — expect failure.** `npm test -w client`
  - Expected: FAIL — Vitest cannot resolve `./App` (`Failed to load url ./App` / module not found). `Test Files 1 failed`.

- [ ] **Step 13: Implement `client/src/App.tsx`** — "company trello" heading on the cream background using the theme tokens.
  ```tsx
  export default function App() {
    return (
      <div className="min-h-screen bg-cream text-ink flex items-center justify-center">
        <h1 className="text-2xl font-semibold">company trello</h1>
      </div>
    );
  }
  ```

- [ ] **Step 14: Run the test — expect pass.** `npm test -w client`
  - Expected: `Test Files 1 passed (1)` · `Tests 1 passed (1)`.

- [ ] **Step 15: Build the client (typecheck + bundle).** `npm run build -w client`
  - Expected: `tsc -b` produces no type errors, then Vite prints `✓ built in …` and writes `client/dist/index.html` + `client/dist/assets/*`.

- [ ] **Step 16: Run the full root test suite.** `npm test`
  - Expected: server `1 passed`, then client `1 passed`; overall exit 0.

- [ ] **Step 17: Manually verify `npm run dev` serves both.** In one terminal run `npm run dev`; wait for `[server] server listening on http://0.0.0.0:3000` and `[client] ➜ Local: http://localhost:5173/`. Then:
  - Open `http://localhost:5173/` in a browser → expected: centered "company trello" heading, deep-brown text on a warm-cream page.
  - In another terminal: `curl http://localhost:3000/api/health` → expected: `{"status":"ok"}`.
  - Confirm the client dev proxy works: `curl http://localhost:5173/api/health` → expected: `{"status":"ok"}` (proxied to the server).
  - Stop with Ctrl-C.

- [ ] **Step 18: Commit.**
  ```
  git add -A && git commit -m "feat: minimal vite react client with tailwind v4 warm theme" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 1.4: Playwright + Docker + end-to-end smoke

**Files:** `playwright.config.ts`, `e2e/smoke.spec.ts`, `.dockerignore`, `Dockerfile`

- [ ] **Step 1: Create `playwright.config.ts`.** `webServer` builds both workspaces then starts the real Fastify server (which serves the built `client/dist`) on a temp `DATA_DIR`; tests target port 3000.
  ```ts
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    fullyParallel: true,
    use: {
      baseURL: 'http://localhost:3000',
    },
    webServer: {
      command: 'npm run build && npm run start -w server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PORT: '3000',
        DATA_DIR: './.data-e2e',
        NODE_ENV: 'production',
      },
    },
  });
  ```

- [ ] **Step 2: Create the e2e smoke spec** `e2e/smoke.spec.ts` (asserts the single-service app serves both the SPA and the API):
  ```ts
  import { test, expect } from '@playwright/test';

  test('serves the built app shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /company trello/i })).toBeVisible();
  });

  test('health endpoint responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toEqual({ status: 'ok' });
  });
  ```

- [ ] **Step 3: Create `.dockerignore`.**
  ```dockerignore
  node_modules
  **/node_modules
  client/dist
  server/dist
  data
  .data-e2e
  e2e/.data
  playwright-report
  test-results
  .git
  .env
  *.log
  ```

- [ ] **Step 4: Create the multi-stage `Dockerfile`** (build client+server, run the server serving `client/dist`; server runs via `tsx` so the `@shared/types` alias resolves at runtime).
  ```dockerfile
  # syntax=docker/dockerfile:1

  FROM node:22-slim AS builder
  WORKDIR /app
  COPY package.json package-lock.json ./
  COPY client/package.json ./client/package.json
  COPY server/package.json ./server/package.json
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:22-slim AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=3000
  ENV DATA_DIR=/data
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./package.json
  COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
  COPY --from=builder /app/shared ./shared
  COPY --from=builder /app/server ./server
  COPY --from=builder /app/client/dist ./client/dist
  EXPOSE 3000
  WORKDIR /app/server
  CMD ["npx", "tsx", "src/index.ts"]
  ```

- [ ] **Step 5: Install the Playwright browser.** Run `npx playwright install chromium`.
  - Expected: downloads Chromium (and headless shell) into the Playwright cache; ends without error.

- [ ] **Step 6: Run the e2e suite — expect pass.** `npm run e2e`
  - Expected: Playwright starts the `webServer` (root `npm run build` runs, then the server logs `server listening on http://0.0.0.0:3000`), waits for `/api/health`, then `2 passed`.

- [ ] **Step 7: Build the Docker image.** Run `docker build -t company-trello .`
  - Expected: both stages complete; final line `naming to docker.io/library/company-trello` (or `writing image sha256:…`). If Docker is unavailable in this environment, note it and skip Steps 7–8 (they are re-verified in section 12).

- [ ] **Step 8: Smoke-test the container.** Run `docker run -d --rm -p 3000:3000 --name ct-smoke company-trello`, wait ~2s, then:
  - `curl http://localhost:3000/api/health` → expected: `{"status":"ok"}`.
  - `curl -s http://localhost:3000/ | grep -o "<title>company trello</title>"` → expected: `<title>company trello</title>` (SPA shell served from `client/dist`).
  - Stop: `docker stop ct-smoke`.

- [ ] **Step 9: Commit.**
  ```
  git add -A && git commit -m "chore: playwright config, e2e smoke test, and multi-stage Dockerfile" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Section verification (all must hold before section 2)

- [ ] `npm test` (root) → server `1 passed`, client `1 passed`.
- [ ] `npm run dev` → server on `:3000`, client on `:5173`; browser shows "company trello" on cream; `/api/health` returns `{"status":"ok"}` directly and via the client proxy.
- [ ] `npm run build` (root) → server typecheck clean, client `client/dist` produced.
- [ ] `npm run e2e` → `2 passed` (webServer built and started the real server).
- [ ] `docker build` succeeds and the container serves both `/api/health` and the SPA shell (skip only if Docker is unavailable here; section 12 re-verifies).


---

## Section 2: Database schema, migrations, position utility

Builds the persistence layer on the scaffolding from Section 1 (npm workspaces; the `server` workspace already has `package.json` with `"test": "vitest run"`, `"dev": "tsx watch src/index.ts"`, `"build": "tsc"`, and the `@shared/types` path alias). This section adds the Drizzle schema for all 16 tables, programmatic migrations applied by `createDb`, and the server-side fractional-index `positionBetween` utility — each built test-first.

**Files**

- Create: `server/src/lib/position.ts`
- Create: `server/src/db/schema.ts`
- Create: `server/src/db/index.ts`
- Create: `server/drizzle.config.ts`
- Create (generated by drizzle-kit): `server/drizzle/0000_*.sql`, `server/drizzle/meta/_journal.json`, `server/drizzle/meta/0000_snapshot.json`
- Modify: `server/package.json` (add `db:generate` script; dependencies added via `npm install`)
- Test: `server/test/position.test.ts`
- Test: `server/test/db.test.ts`

> **Design note (read before writing the position tests).** `positionBetween` delegates to `generateKeyBetween` from the `fractional-indexing` pkg and appends a 2-char random jitter suffix. Jitter keeps concurrent "append to end" inserts from persisting identical keys; the app's global sort is always `ORDER BY (position, id)` so any residual tie is still deterministic. Two facts, verified against the real pkg, constrain the tests:
> 1. `generateKeyBetween(x, null)` always increments the integer part (e.g. `('a0Xy', null) → 'a1'`), so `positionBetween(x, null)` is strictly greater than `x` and jitter never breaks it. **The server only ever calls `positionBetween` with `b = null`** (every create appends to the end; drag/move positions are computed jitter-free on the client and sent in the PATCH body). So the append case is the one that must be rock-solid.
> 2. When bounds straddle an integer boundary, `generateKeyBetween` returns a *prefix* of the upper bound (`('a0Xy','a1Zw') → 'a1'`, `(null,'a0Xy') → 'a0'`); appending jitter to a prefix can sort *past* the upper bound. So the "between" test MUST use bounds that share an integer part (e.g. `'a0V'`/`'a0k'` → `'a0d'`, which diverges mid-string and stays strictly between after jitter). Do NOT write a test asserting `positionBetween(null, x) < x` — it is flaky by construction.
>
> The jitter's last character must never be `'0'`: `fractional-indexing` rejects any key ending in the alphabet's first digit (`generateKeyBetween('a0Vx0', null)` throws `invalid order key`), and a rejected key would crash the next insert that uses it as a bound.

---

### Task 2.1: Fractional-index position utility (TDD)

**Files:** `server/src/lib/position.ts`, `server/test/position.test.ts`

- [ ] **Step 1: Install the `fractional-indexing` dependency into the server workspace** (idempotent — Section 1 may already list it). Run:
  ```
  npm install fractional-indexing@^3 -w server
  ```
  Expected: npm prints `added N packages` (or `up to date` / `changed 0 packages`) with exit code 0.

- [ ] **Step 2: Write the failing test file `server/test/position.test.ts`** with this exact content:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { positionBetween } from '../src/lib/position';

  describe('positionBetween', () => {
    it('appends after a key when the upper bound is open, staying ascending', () => {
      const first = positionBetween(null, null);
      const second = positionBetween(first, null);
      const third = positionBetween(second, null);
      expect(first < second).toBe(true);
      expect(second < third).toBe(true);
    });

    it('produces a key strictly between neighbours that share an integer part', () => {
      const lo = 'a0V';
      const hi = 'a0k';
      const mid = positionBetween(lo, hi);
      expect(lo < mid).toBe(true);
      expect(mid < hi).toBe(true);
    });

    it('appends jitter so repeated calls between identical bounds rarely collide', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) keys.add(positionBetween(null, null));
      expect(keys.size).toBeGreaterThanOrEqual(90);
    });

    it('sorts by (position, id) as a deterministic tie-break for equal positions', () => {
      const rows = [
        { position: 'a0', id: 'm2' },
        { position: 'a0', id: 'm1' },
      ];
      rows.sort((x, y) =>
        x.position === y.position
          ? x.id.localeCompare(y.id)
          : x.position.localeCompare(y.position),
      );
      expect(rows.map((r) => r.id)).toEqual(['m1', 'm2']);
    });
  });
  ```

- [ ] **Step 3: Run the test and confirm it fails (RED).** Run:
  ```
  npm test -w server -- position
  ```
  Expected: FAIL — vitest cannot resolve the import and reports `Failed to resolve import "../src/lib/position"` (0 tests collected), exit code 1.

- [ ] **Step 4: Write the implementation `server/src/lib/position.ts`** with this exact content:
  ```ts
  import { generateKeyBetween } from 'fractional-indexing';

  const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  function jitter(): string {
    const first = DIGITS[Math.floor(Math.random() * DIGITS.length)];
    // Last char must not be DIGITS[0] ('0'): fractional-indexing rejects any key
    // ending in the alphabet's first digit, which would break a later insert.
    const last = DIGITS[1 + Math.floor(Math.random() * (DIGITS.length - 1))];
    return first + last;
  }

  export function positionBetween(a: string | null, b: string | null): string {
    return generateKeyBetween(a, b) + jitter();
  }
  ```

- [ ] **Step 5: Run the test and confirm it passes (GREEN).** Run:
  ```
  npm test -w server -- position
  ```
  Expected: PASS — `Test Files 1 passed (1)`, `Tests 4 passed (4)`, exit code 0.

- [ ] **Step 6: Commit.** Run:
  ```
  git add -A && git commit -m "feat(server): add positionBetween fractional-index utility" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 2.2: Drizzle schema, generated migrations, and createDb (TDD)

**Files:** `server/test/db.test.ts`, `server/src/db/schema.ts`, `server/drizzle.config.ts`, `server/package.json`, `server/src/db/index.ts`, generated `server/drizzle/*`

- [ ] **Step 1: Install the database dependencies into the server workspace** (idempotent). Run both:
  ```
  npm install drizzle-orm better-sqlite3 -w server
  npm install -D drizzle-kit @types/better-sqlite3 -w server
  ```
  Expected: each prints `added N packages` / `up to date`, exit code 0.

- [ ] **Step 2: Write the failing test file `server/test/db.test.ts`** with this exact content:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { mkdtempSync, rmSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import { createDb } from '../src/db/index';

  const TABLES = [
    'users', 'sessions', 'invites', 'password_resets',
    'boards', 'board_members', 'lists', 'cards',
    'card_assignees', 'labels', 'card_labels', 'checklist_items',
    'comments', 'attachments', 'activity', 'notifications',
  ];

  describe('createDb', () => {
    it('creates every table from the migrations', () => {
      const { sqlite } = createDb(':memory:');
      const names = (
        sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
      ).map((r) => r.name);
      for (const t of TABLES) expect(names).toContain(t);
      sqlite.close();
    });

    it('enables foreign key enforcement', () => {
      const { sqlite } = createDb(':memory:');
      expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
      sqlite.close();
    });

    it('uses WAL journal mode for file-backed databases', () => {
      const dir = mkdtempSync(join(tmpdir(), 'trello-db-'));
      const { sqlite } = createDb(join(dir, 'app.db'));
      expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });
  ```

- [ ] **Step 3: Run the test and confirm it fails (RED).** Run:
  ```
  npm test -w server -- db
  ```
  Expected: FAIL — vitest reports `Failed to resolve import "../src/db/index"` (0 tests collected), exit code 1.

- [ ] **Step 4: Write the schema `server/src/db/schema.ts`** with this exact content (all 16 tables, snake_case SQL names, camelCase TS; cascade deletes where the contract requires them — `label → card_labels`, and card/board children so admin purge cascades cleanly):
  ```ts
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
  ```

- [ ] **Step 5: Write the drizzle-kit config `server/drizzle.config.ts`** with this exact content:
  ```ts
  import { defineConfig } from 'drizzle-kit';

  export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/schema.ts',
    out: './drizzle',
  });
  ```

- [ ] **Step 6: Add the migration-generation script to `server/package.json`.** In the `"scripts"` object, add this entry (place it right after the existing `"build"` line, keeping valid JSON commas):
  ```json
  "db:generate": "drizzle-kit generate",
  ```

- [ ] **Step 7: Generate the migration files.** Run:
  ```
  npm run db:generate -w server
  ```
  Expected: drizzle-kit prints `[✓] Your SQL migration file ➜ drizzle/0000_<name>.sql 🚀` and creates `server/drizzle/0000_*.sql` plus `server/drizzle/meta/_journal.json`, exit code 0.

- [ ] **Step 8: Verify the migration contains all 16 tables.** Run:
  ```
  grep -c "CREATE TABLE" server/drizzle/0000_*.sql
  ```
  Expected: prints `16`.

- [ ] **Step 9: Write `server/src/db/index.ts`** with this exact content (opens better-sqlite3, sets WAL + foreign keys, applies migrations programmatically from the co-located `drizzle/` folder):
  ```ts
  import Database from 'better-sqlite3';
  import { drizzle } from 'drizzle-orm/better-sqlite3';
  import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
  import { fileURLToPath } from 'node:url';
  import { dirname, join } from 'node:path';
  import * as schema from './schema';

  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

  export function createDb(path: string) {
    const sqlite = new Database(path);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder });
    return { db, sqlite };
  }

  export type Db = ReturnType<typeof createDb>['db'];
  ```

- [ ] **Step 10: Run the test and confirm it passes (GREEN).** Run:
  ```
  npm test -w server -- db
  ```
  Expected: PASS — `Test Files 1 passed (1)`, `Tests 3 passed (3)`, exit code 0.

- [ ] **Step 11: Confirm the full server suite is green** (both position and db tests). Run:
  ```
  npm test -w server
  ```
  Expected: PASS — `Test Files 2 passed (2)`, `Tests 7 passed (7)`, exit code 0.

- [ ] **Step 12: Commit.** Run:
  ```
  git add -A && git commit -m "feat(server): add drizzle schema, migrations, and createDb" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```


---

## Section 3: Auth: sessions, bootstrap, invites, password resets

Depends on artifacts from Section 1 (scaffold: `server/package.json`, `server/src/app.ts` stub `buildApp`, `server/src/index.ts` stub, `shared/types.ts`, `@shared/types` alias, vitest+tsconfig, git repo) and Section 2 (`server/src/db/schema.ts` Drizzle tables, `server/src/db/index.ts` `createDb(path|':memory:') → { db, sqlite }` running migrations). This section owns all authentication infrastructure and is the first section to turn `buildApp` into a real route host; later sections (4–7) append their own route registrations to `server/src/app.ts` after the block created here.

### Files

**Create**
- `server/src/lib/passwords.ts` — `hashPassword` / `verifyPassword` (bcryptjs cost 12)
- `server/src/lib/perms.ts` — serializers, avatar-color helper, session helpers, `requireAuth`/`requireAdmin` preHandlers, `canAccessBoard`
- `server/src/bootstrap.ts` — `firstRunBootstrap(db)`
- `server/src/routes/auth.ts` — `registerAuthRoutes(app)`: login, logout, me, accept-invite, reset-password

**Modify**
- `server/package.json` — add deps `bcryptjs`, `@fastify/cookie`, `@fastify/rate-limit`, `nanoid` (via `npm install`)
- `server/src/app.ts` — decorate `db`/`dataDir`/`emit`, register cookie + rate-limit, register auth routes, Fastify module augmentation
- `server/src/index.ts` — call `firstRunBootstrap(db)` between `createDb` and `buildApp`

**Test**
- `server/test/helpers.ts` — `makeApp()` / `seedUser()` / `login()`
- `server/test/passwords.test.ts`
- `server/test/perms.test.ts`
- `server/test/bootstrap.test.ts`
- `server/test/auth-login.test.ts`
- `server/test/auth-invite.test.ts`
- `server/test/auth-reset.test.ts`
- `server/test/auth-hardening.test.ts`

---

### Task 3.1: Password hashing helpers

Files: `server/package.json`, `server/src/lib/passwords.ts`, `server/test/passwords.test.ts`

- [ ] **Step 1: Install auth dependencies** into the server workspace (idempotent if Section 1 already added some).
  ```bash
  npm install -w server bcryptjs@^3 @fastify/cookie@^11 @fastify/rate-limit@^10 nanoid@^5
  ```
  Expected: install completes; `server/package.json` `dependencies` now include `bcryptjs`, `@fastify/cookie`, `@fastify/rate-limit`, `nanoid`. (bcryptjs v3 and nanoid v5 ship their own types — no `@types/*` needed.)

- [ ] **Step 2: Write the failing test** `server/test/passwords.test.ts`.
  ```ts
  import { describe, it, expect } from 'vitest';
  import { hashPassword, verifyPassword } from '../src/lib/passwords.js';

  describe('passwords', () => {
    it('hashes to a bcrypt string that is not the plaintext', () => {
      const hash = hashPassword('hunter2!');
      expect(hash).not.toBe('hunter2!');
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('verifies a correct password', () => {
      const hash = hashPassword('hunter2!');
      expect(verifyPassword('hunter2!', hash)).toBe(true);
    });

    it('rejects a wrong password', () => {
      const hash = hashPassword('hunter2!');
      expect(verifyPassword('wrong', hash)).toBe(false);
    });
  });
  ```

- [ ] **Step 3: Run the test — expect failure.**
  ```bash
  npm test -w server -- passwords
  ```
  Expected: fails to resolve `../src/lib/passwords.js` (file not created yet) — "Failed to resolve import".

- [ ] **Step 4: Create** `server/src/lib/passwords.ts`.
  ```ts
  import bcrypt from 'bcryptjs';

  export function hashPassword(plain: string): string {
    return bcrypt.hashSync(plain, 12);
  }

  export function verifyPassword(plain: string, hash: string): boolean {
    return bcrypt.compareSync(plain, hash);
  }
  ```

- [ ] **Step 5: Run the test — expect pass.**
  ```bash
  npm test -w server -- passwords
  ```
  Expected: `Test Files 1 passed`, `Tests 3 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add server/package.json server/package-lock.json server/src/lib/passwords.ts server/test/passwords.test.ts && git commit -m "$(cat <<'EOF'
  feat: bcrypt password hashing helpers (cost 12)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```
  (If the lockfile lives at repo root, use `package-lock.json` instead of `server/package-lock.json`.)

---

### Task 3.2: Perms library — serializers, avatar color, sessions, canAccessBoard

Files: `server/src/lib/perms.ts`, `server/test/perms.test.ts`

This task also defines the `requireAuth` / `requireAdmin` preHandlers in `perms.ts`; those are exercised through real routes in Tasks 3.4 and 3.7 (they need a running app). Task 3.2 unit-tests only the pure/db helpers.

- [ ] **Step 1: Write the failing test** `server/test/perms.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { nanoid } from 'nanoid';
  import { eq } from 'drizzle-orm';
  import { createDb } from '../src/db/index.js';
  import * as schema from '../src/db/schema.js';
  import {
    toMe, toUserPublic, randomAvatarColor, canAccessBoard,
    createSession, revokeSession, revokeUserSessions,
  } from '../src/lib/perms.js';
  import { LABEL_HEX } from '@shared/types';

  type Db = ReturnType<typeof createDb>['db'];

  function mkUser(db: Db, over: { id?: string; email?: string; isAdmin?: boolean } = {}) {
    const id = over.id ?? nanoid(12);
    db.insert(schema.users).values({
      id,
      email: over.email ?? `${id}@x.com`,
      name: 'U',
      passwordHash: 'x',
      avatarColor: 'coral',
      isAdmin: over.isAdmin ?? false,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    return id;
  }

  function mkBoard(db: Db, over: { visibility: 'team' | 'private'; createdBy: string }) {
    const id = nanoid(12);
    db.insert(schema.boards).values({
      id,
      name: 'B',
      accentColor: 'coral',
      visibility: over.visibility,
      createdBy: over.createdBy,
      archivedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    return id;
  }

  let db: Db;
  beforeEach(() => { db = createDb(':memory:').db; });

  describe('serializers', () => {
    it('toUserPublic omits emailNotifications; toMe includes it', () => {
      const id = mkUser(db, { email: 'a@x.com', isAdmin: true });
      const row = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
      const pub = toUserPublic(row);
      expect(pub).toEqual({ id, name: 'U', email: 'a@x.com', avatarColor: 'coral', isAdmin: true, deactivated: false });
      expect('emailNotifications' in pub).toBe(false);
      expect(toMe(row).emailNotifications).toBe(true);
    });

    it('deactivated maps to true when deactivatedAt set', () => {
      const id = mkUser(db);
      db.update(schema.users).set({ deactivatedAt: new Date().toISOString() }).where(eq(schema.users.id, id)).run();
      const row = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
      expect(toUserPublic(row).deactivated).toBe(true);
    });
  });

  describe('randomAvatarColor', () => {
    it('returns one of the 8 label color names', () => {
      const names = Object.keys(LABEL_HEX);
      expect(names).toContain(randomAvatarColor());
    });
  });

  describe('sessions', () => {
    it('createSession inserts a row with a ~30-day future expiry', () => {
      const uid = mkUser(db);
      const token = createSession(db, uid);
      const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, token)).get()!;
      expect(row.userId).toBe(uid);
      expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    });

    it('revokeSession deletes one; revokeUserSessions deletes all for a user', () => {
      const uid = mkUser(db);
      const t1 = createSession(db, uid);
      const t2 = createSession(db, uid);
      revokeSession(db, t1);
      expect(db.select().from(schema.sessions).where(eq(schema.sessions.id, t1)).get()).toBeUndefined();
      expect(db.select().from(schema.sessions).where(eq(schema.sessions.id, t2)).get()).toBeDefined();
      revokeUserSessions(db, uid);
      expect(db.select().from(schema.sessions).where(eq(schema.sessions.userId, uid)).all()).toHaveLength(0);
    });
  });

  describe('canAccessBoard', () => {
    it('returns false for a missing board', () => {
      expect(canAccessBoard(db, mkUser(db), 'nope')).toBe(false);
    });
    it('team board: any user can access', () => {
      const owner = mkUser(db);
      const other = mkUser(db);
      const board = mkBoard(db, { visibility: 'team', createdBy: owner });
      expect(canAccessBoard(db, other, board)).toBe(true);
    });
    it('private board: member yes, non-member no', () => {
      const owner = mkUser(db);
      const member = mkUser(db);
      const stranger = mkUser(db);
      const board = mkBoard(db, { visibility: 'private', createdBy: owner });
      db.insert(schema.boardMembers).values({ boardId: board, userId: member, starred: false }).run();
      expect(canAccessBoard(db, member, board)).toBe(true);
      expect(canAccessBoard(db, stranger, board)).toBe(false);
    });
    it('private board: admin can access without membership', () => {
      const owner = mkUser(db);
      const admin = mkUser(db, { isAdmin: true });
      const board = mkBoard(db, { visibility: 'private', createdBy: owner });
      expect(canAccessBoard(db, admin, board)).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- perms
  ```
  Expected: fails to resolve `../src/lib/perms.js`.

- [ ] **Step 3: Create** `server/src/lib/perms.ts` (full file).
  ```ts
  import type { FastifyReply, FastifyRequest } from 'fastify';
  import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import { and, eq, gt } from 'drizzle-orm';
  import { randomBytes } from 'node:crypto';
  import * as schema from '../db/schema.js';
  import { LABEL_HEX, type LabelColor, type Me, type UserPublic } from '@shared/types';

  type Db = BetterSQLite3Database<typeof schema>;
  type UserRow = typeof schema.users.$inferSelect;

  export const SESSION_COOKIE = 'sid';
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const AVATAR_COLORS = Object.keys(LABEL_HEX) as LabelColor[];

  export function randomAvatarColor(): string {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  }

  export function toUserPublic(u: UserRow): UserPublic {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarColor: u.avatarColor,
      isAdmin: u.isAdmin,
      deactivated: u.deactivatedAt !== null,
    };
  }

  export function toMe(u: UserRow): Me {
    return { ...toUserPublic(u), emailNotifications: u.emailNotifications };
  }

  function sessionCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: THIRTY_DAYS_MS / 1000,
    };
  }

  export function setSessionCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
  }

  export function createSession(db: Db, userId: string): string {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
    db.insert(schema.sessions).values({ id: token, userId, expiresAt }).run();
    return token;
  }

  export function revokeSession(db: Db, token: string): void {
    db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
  }

  export function revokeUserSessions(db: Db, userId: string): void {
    db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
  }

  export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const db = request.server.db;
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }
    const now = new Date().toISOString();
    const session = db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, now)))
      .get();
    if (!session) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }
    const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
    if (!user || user.deactivatedAt !== null) {
      db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }
    db.update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString() })
      .where(eq(schema.sessions.id, token))
      .run();
    setSessionCookie(reply, token);
    request.user = toMe(user);
  }

  export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user?.isAdmin) {
      reply.code(403).send({ error: 'Admin only' });
    }
  }

  export function canAccessBoard(db: Db, userId: string, boardId: string): boolean {
    const board = db.select().from(schema.boards).where(eq(schema.boards.id, boardId)).get();
    if (!board) return false;
    if (board.visibility === 'team') return true;
    const member = db
      .select()
      .from(schema.boardMembers)
      .where(and(eq(schema.boardMembers.boardId, boardId), eq(schema.boardMembers.userId, userId)))
      .get();
    if (member) return true;
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    return !!user && user.isAdmin;
  }
  ```
  Note: `request.server.db`, `request.user`, `request.cookies`, and `reply.setCookie/clearCookie` are typed via the module augmentation and `@fastify/cookie` import added in Task 3.4's `app.ts`; the vitest run here does not type-check, so it passes on runtime behavior. The full `tsc` build is verified at the end of Task 3.4.

- [ ] **Step 4: Run the test — expect pass.**
  ```bash
  npm test -w server -- perms
  ```
  Expected: `Test Files 1 passed`, `Tests 9 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add server/src/lib/perms.ts server/test/perms.test.ts && git commit -m "$(cat <<'EOF'
  feat: perms library — serializers, sessions, canAccessBoard, auth preHandlers

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.3: First-run bootstrap

Files: `server/src/bootstrap.ts`, `server/test/bootstrap.test.ts`

- [ ] **Step 1: Write the failing test** `server/test/bootstrap.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { createDb } from '../src/db/index.js';
  import * as schema from '../src/db/schema.js';
  import { firstRunBootstrap } from '../src/bootstrap.js';
  import { verifyPassword } from '../src/lib/passwords.js';

  type Db = ReturnType<typeof createDb>['db'];

  const saved = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  let db: Db;

  beforeEach(() => {
    db = createDb(':memory:').db;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  });
  afterEach(() => {
    process.env.ADMIN_EMAIL = saved.email;
    process.env.ADMIN_PASSWORD = saved.password;
    if (saved.email === undefined) delete process.env.ADMIN_EMAIL;
    if (saved.password === undefined) delete process.env.ADMIN_PASSWORD;
  });

  describe('firstRunBootstrap', () => {
    it('throws when users are empty and env is unset', () => {
      expect(() => firstRunBootstrap(db)).toThrow(/ADMIN_EMAIL/);
    });

    it('creates the admin from env when users are empty', () => {
      process.env.ADMIN_EMAIL = 'Owner@Example.com';
      process.env.ADMIN_PASSWORD = 'sup3r-secret';
      firstRunBootstrap(db);
      const rows = db.select().from(schema.users).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('owner@example.com');
      expect(rows[0].isAdmin).toBe(true);
      expect(verifyPassword('sup3r-secret', rows[0].passwordHash)).toBe(true);
    });

    it('is a no-op when at least one user exists', () => {
      db.insert(schema.users).values({
        id: 'existing00001',
        email: 'a@x.com',
        name: 'A',
        passwordHash: 'x',
        avatarColor: 'coral',
        isAdmin: false,
        emailNotifications: true,
        deactivatedAt: null,
        createdAt: new Date().toISOString(),
      }).run();
      process.env.ADMIN_EMAIL = 'owner@example.com';
      process.env.ADMIN_PASSWORD = 'sup3r-secret';
      firstRunBootstrap(db);
      expect(db.select().from(schema.users).all()).toHaveLength(1);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- bootstrap
  ```
  Expected: fails to resolve `../src/bootstrap.js`.

- [ ] **Step 3: Create** `server/src/bootstrap.ts`.
  ```ts
  import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import { nanoid } from 'nanoid';
  import * as schema from './db/schema.js';
  import { hashPassword } from './lib/passwords.js';
  import { randomAvatarColor } from './lib/perms.js';

  type Db = BetterSQLite3Database<typeof schema>;

  export function firstRunBootstrap(db: Db): void {
    const existing = db.select().from(schema.users).limit(1).get();
    if (existing) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        'No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set. ' +
          'Set both to bootstrap the first admin account.',
      );
    }

    db.insert(schema.users).values({
      id: nanoid(12),
      email: email.toLowerCase(),
      name: email.split('@')[0],
      passwordHash: hashPassword(password),
      avatarColor: randomAvatarColor(),
      isAdmin: true,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
  }
  ```

- [ ] **Step 4: Run the test — expect pass.**
  ```bash
  npm test -w server -- bootstrap
  ```
  Expected: `Test Files 1 passed`, `Tests 3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add server/src/bootstrap.ts server/test/bootstrap.test.ts && git commit -m "$(cat <<'EOF'
  feat: first-run admin bootstrap from ADMIN_EMAIL/ADMIN_PASSWORD

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.4: App wiring, test helpers, and login/logout/me routes

Files: `server/src/app.ts`, `server/src/routes/auth.ts`, `server/src/index.ts`, `server/test/helpers.ts`, `server/test/auth-login.test.ts`

- [ ] **Step 1: Create test helpers** `server/test/helpers.ts`.
  ```ts
  import type { FastifyInstance } from 'fastify';
  import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import { nanoid } from 'nanoid';
  import { createDb } from '../src/db/index.js';
  import { buildApp } from '../src/app.js';
  import * as schema from '../src/db/schema.js';
  import { hashPassword } from '../src/lib/passwords.js';

  type Db = BetterSQLite3Database<typeof schema>;

  export function makeApp(): { app: FastifyInstance; db: Db } {
    const { db } = createDb(':memory:');
    const app = buildApp({ db, dataDir: '/tmp/company-trello-test', emit: { boardChanged: () => {} } });
    return { app, db };
  }

  export function seedUser(
    db: Db,
    opts: { email: string; name: string; password: string; isAdmin?: boolean },
  ): { id: string; email: string; name: string; isAdmin: boolean } {
    const id = nanoid(12);
    const email = opts.email.toLowerCase();
    db.insert(schema.users).values({
      id,
      email,
      name: opts.name,
      passwordHash: hashPassword(opts.password),
      avatarColor: 'coral',
      isAdmin: opts.isAdmin ?? false,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    return { id, email, name: opts.name, isAdmin: opts.isAdmin ?? false };
  }

  export async function login(app: FastifyInstance, email: string, password: string): Promise<string> {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
    const setCookie = res.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!raw) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
    return raw.split(';')[0];
  }
  ```

- [ ] **Step 2: Write the failing test** `server/test/auth-login.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import type { FastifyInstance } from 'fastify';
  import { makeApp, seedUser, login } from './helpers.js';

  let app: FastifyInstance;

  beforeEach(() => {
    const ctx = makeApp();
    app = ctx.app;
    seedUser(ctx.db, { email: 'sam@x.com', name: 'Sam', password: 'correct-horse' });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials and sets the sid cookie', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'sam@x.com', password: 'correct-horse' } });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe('sam@x.com');
      const setCookie = res.headers['set-cookie'];
      expect(String(setCookie)).toMatch(/sid=/);
      expect(String(setCookie)).toMatch(/HttpOnly/i);
    });

    it('is case-insensitive on the email', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'SAM@x.com', password: 'correct-horse' } });
      expect(res.statusCode).toBe(200);
    });

    it('returns a generic 401 on a wrong password', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'sam@x.com', password: 'nope' } });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid email or password');
    });

    it('returns the same generic 401 for an unknown email', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'ghost@x.com', password: 'whatever' } });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me and logout', () => {
    it('401 without a cookie', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
      expect(res.statusCode).toBe(401);
    });

    it('returns Me with a valid cookie, then 401 after logout', async () => {
      const cookie = await login(app, 'sam@x.com', 'correct-horse');
      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(me.statusCode).toBe(200);
      expect(me.json().name).toBe('Sam');
      expect(me.json().emailNotifications).toBe(true);

      const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
      expect(out.statusCode).toBe(200);

      const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(after.statusCode).toBe(401);
    });
  });
  ```

- [ ] **Step 3: Run the test — expect failure.**
  ```bash
  npm test -w server -- auth-login
  ```
  Expected: fails resolving `../src/routes/auth.js` (imported by `app.ts`) or 404s on `/api/auth/login` — routes not implemented yet.

- [ ] **Step 4: Create** `server/src/routes/auth.ts`.
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { z } from 'zod';
  import { and, eq, isNull } from 'drizzle-orm';
  import { nanoid } from 'nanoid';
  import * as schema from '../db/schema.js';
  import { hashPassword, verifyPassword } from '../lib/passwords.js';
  import {
    requireAuth,
    toMe,
    randomAvatarColor,
    createSession,
    revokeSession,
    revokeUserSessions,
    setSessionCookie,
  } from '../lib/perms.js';

  const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) });
  const acceptBody = z.object({ token: z.string().min(1), name: z.string().min(1), password: z.string().min(8) });
  const resetBody = z.object({ token: z.string().min(1), password: z.string().min(8) });

  export function registerAuthRoutes(app: FastifyInstance): void {
    const db = app.db;

    app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
      const parsed = loginBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
      const { email, password } = parsed.data;
      const user = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get();
      if (!user || user.deactivatedAt !== null || !verifyPassword(password, user.passwordHash)) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }
      setSessionCookie(reply, createSession(db, user.id));
      return toMe(user);
    });

    app.post('/api/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
      const token = request.cookies.sid;
      if (token) revokeSession(db, token);
      reply.clearCookie('sid', { path: '/' });
      return { ok: true };
    });

    app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
      return request.user;
    });

    app.post('/api/auth/accept-invite', async (request, reply) => {
      const parsed = acceptBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
      const { token, name, password } = parsed.data;
      const now = new Date().toISOString();
      const invite = db
        .select()
        .from(schema.invites)
        .where(and(eq(schema.invites.id, token), isNull(schema.invites.usedAt)))
        .get();
      if (!invite || invite.expiresAt <= now) {
        return reply.code(400).send({ error: 'Invalid or expired invite' });
      }
      const email = invite.email.toLowerCase();
      if (db.select().from(schema.users).where(eq(schema.users.email, email)).get()) {
        return reply.code(400).send({ error: 'An account with this email already exists' });
      }
      const userId = nanoid(12);
      db.insert(schema.users).values({
        id: userId,
        email,
        name,
        passwordHash: hashPassword(password),
        avatarColor: randomAvatarColor(),
        isAdmin: false,
        emailNotifications: true,
        deactivatedAt: null,
        createdAt: now,
      }).run();
      db.update(schema.invites)
        .set({ usedAt: now })
        .where(and(eq(schema.invites.email, invite.email), isNull(schema.invites.usedAt)))
        .run();
      setSessionCookie(reply, createSession(db, userId));
      const created = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
      return toMe(created);
    });

    app.post('/api/auth/reset-password', async (request, reply) => {
      const parsed = resetBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
      const { token, password } = parsed.data;
      const now = new Date().toISOString();
      const resetRow = db
        .select()
        .from(schema.passwordResets)
        .where(and(eq(schema.passwordResets.id, token), isNull(schema.passwordResets.usedAt)))
        .get();
      if (!resetRow || resetRow.expiresAt <= now) {
        return reply.code(400).send({ error: 'Invalid or expired reset link' });
      }
      db.update(schema.users).set({ passwordHash: hashPassword(password) }).where(eq(schema.users.id, resetRow.userId)).run();
      db.update(schema.passwordResets).set({ usedAt: now }).where(eq(schema.passwordResets.id, token)).run();
      revokeUserSessions(db, resetRow.userId);
      const user = db.select().from(schema.users).where(eq(schema.users.id, resetRow.userId)).get()!;
      setSessionCookie(reply, createSession(db, user.id));
      return toMe(user);
    });
  }
  ```

- [ ] **Step 5: Overwrite** `server/src/app.ts` (turns the Section 1 stub into the real route host; later sections append their `registerXRoutes(app)` calls after the auth block).
  ```ts
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

    app.register(cookie, { secret: process.env.SESSION_SECRET ?? 'dev-session-secret' });

    // Rate-limit is applied per-route (login). Register it inside an encapsulated
    // plugin and await it so its onRoute hook is active before routes are added.
    app.register(async (instance) => {
      await instance.register(rateLimit, { global: false });
      registerAuthRoutes(instance);
    });

    return app;
  }
  ```

- [ ] **Step 6: Wire bootstrap into** `server/src/index.ts` (overwrite; Section 7 will extend this with `setupRealtime` + `startJobs`).
  ```ts
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
  ```

- [ ] **Step 7: Run the login test — expect pass.**
  ```bash
  npm test -w server -- auth-login
  ```
  Expected: `Test Files 1 passed`, `Tests 6 passed`.

- [ ] **Step 8: Type-check the whole server workspace** (confirms the Fastify module augmentation and `request.server.db` / `request.user` usage in `perms.ts`).
  ```bash
  npm run build -w server
  ```
  Expected: `tsc` exits 0, no type errors.

- [ ] **Step 9: Commit.**
  ```bash
  git add server/src/app.ts server/src/index.ts server/src/routes/auth.ts server/test/helpers.ts server/test/auth-login.test.ts && git commit -m "$(cat <<'EOF'
  feat: cookie sessions + login/logout/me routes and app wiring

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.5: Accept-invite route

Files: `server/test/auth-invite.test.ts` (route logic already implemented in Task 3.4's `auth.ts`; this task drives it via a failing-first test suite).

- [ ] **Step 1: Write the failing test** `server/test/auth-invite.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import type { FastifyInstance } from 'fastify';
  import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import { eq } from 'drizzle-orm';
  import { makeApp, seedUser } from './helpers.js';
  import * as schema from '../src/db/schema.js';

  type Db = BetterSQLite3Database<typeof schema>;

  let app: FastifyInstance;
  let db: Db;
  let adminId: string;

  function makeInvite(id: string, email: string, opts: { expiresInMs?: number; usedAt?: string | null } = {}) {
    db.insert(schema.invites).values({
      id,
      email,
      invitedBy: adminId,
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 7 * 24 * 60 * 60 * 1000)).toISOString(),
      usedAt: opts.usedAt ?? null,
    }).run();
  }

  beforeEach(() => {
    const ctx = makeApp();
    app = ctx.app;
    db = ctx.db;
    adminId = seedUser(db, { email: 'admin@x.com', name: 'Admin', password: 'admin-pass', isAdmin: true }).id;
  });

  describe('POST /api/auth/accept-invite', () => {
    it('creates a user, logs them in, and returns Me', async () => {
      makeInvite('inv-1', 'new@x.com');
      const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-1', name: 'Newbie', password: 'brand-new-pw' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ email: 'new@x.com', name: 'Newbie', isAdmin: false });
      const cookie = String(res.headers['set-cookie']).split(';')[0];
      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(me.statusCode).toBe(200);
      expect(me.json().email).toBe('new@x.com');
    });

    it('rejects an unknown token with 400', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'nope', name: 'X', password: 'brand-new-pw' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid or expired invite');
    });

    it('rejects an expired token with 400', async () => {
      makeInvite('inv-exp', 'exp@x.com', { expiresInMs: -1000 });
      const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-exp', name: 'X', password: 'brand-new-pw' } });
      expect(res.statusCode).toBe(400);
    });

    it('is single-use: the second accept with the same token fails', async () => {
      makeInvite('inv-once', 'once@x.com');
      const first = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-once', name: 'Once', password: 'brand-new-pw' } });
      expect(first.statusCode).toBe(200);
      const second = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-once', name: 'Twice', password: 'brand-new-pw' } });
      expect(second.statusCode).toBe(400);
    });

    it('invalidates other pending invites for the same email', async () => {
      makeInvite('inv-a', 'dup@x.com');
      makeInvite('inv-b', 'dup@x.com');
      await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-a', name: 'Dup', password: 'brand-new-pw' } });
      const other = db.select().from(schema.invites).where(eq(schema.invites.id, 'inv-b')).get()!;
      expect(other.usedAt).not.toBeNull();
    });

    it('rejects when an account with the email already exists', async () => {
      seedUser(db, { email: 'taken@x.com', name: 'Taken', password: 'pw' });
      makeInvite('inv-taken', 'taken@x.com');
      const res = await app.inject({ method: 'POST', url: '/api/auth/accept-invite', payload: { token: 'inv-taken', name: 'X', password: 'brand-new-pw' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('An account with this email already exists');
    });
  });
  ```

- [ ] **Step 2: Run the test — expect pass** (the route was implemented in Task 3.4).
  ```bash
  npm test -w server -- auth-invite
  ```
  Expected: `Test Files 1 passed`, `Tests 6 passed`.

  If any assertion fails, fix `accept-invite` in `server/src/routes/auth.ts` to match the test, then re-run until green before committing.

- [ ] **Step 3: Commit.**
  ```bash
  git add server/test/auth-invite.test.ts && git commit -m "$(cat <<'EOF'
  test: accept-invite flows (single-use, expiry, dedupe, existing email)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.6: Reset-password route

Files: `server/test/auth-reset.test.ts` (route logic implemented in Task 3.4's `auth.ts`; driven failing-first here).

- [ ] **Step 1: Write the failing test** `server/test/auth-reset.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import type { FastifyInstance } from 'fastify';
  import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import { makeApp, seedUser, login } from './helpers.js';
  import * as schema from '../src/db/schema.js';

  type Db = BetterSQLite3Database<typeof schema>;

  let app: FastifyInstance;
  let db: Db;
  let userId: string;

  function makeReset(id: string, opts: { expiresInMs?: number; usedAt?: string | null } = {}) {
    db.insert(schema.passwordResets).values({
      id,
      userId,
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60 * 60 * 1000)).toISOString(),
      usedAt: opts.usedAt ?? null,
    }).run();
  }

  beforeEach(() => {
    const ctx = makeApp();
    app = ctx.app;
    db = ctx.db;
    userId = seedUser(db, { email: 'rob@x.com', name: 'Rob', password: 'old-password' }).id;
  });

  describe('POST /api/auth/reset-password', () => {
    it('sets a new password, logs in, and returns Me', async () => {
      makeReset('rst-1');
      const res = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-1', password: 'the-new-password' } });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe('rob@x.com');
      expect(String(res.headers['set-cookie'])).toMatch(/sid=/);

      const good = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rob@x.com', password: 'the-new-password' } });
      expect(good.statusCode).toBe(200);
      const old = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rob@x.com', password: 'old-password' } });
      expect(old.statusCode).toBe(401);
    });

    it('rejects an unknown token with 400', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'nope', password: 'the-new-password' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid or expired reset link');
    });

    it('rejects an expired token with 400', async () => {
      makeReset('rst-exp', { expiresInMs: -1000 });
      const res = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-exp', password: 'the-new-password' } });
      expect(res.statusCode).toBe(400);
    });

    it('is single-use: the second reset with the same token fails', async () => {
      makeReset('rst-once');
      const first = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-once', password: 'the-new-password' } });
      expect(first.statusCode).toBe(200);
      const second = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-once', password: 'another-password' } });
      expect(second.statusCode).toBe(400);
    });

    it('revokes the user\'s existing sessions', async () => {
      const cookie = await login(app, 'rob@x.com', 'old-password');
      const before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(before.statusCode).toBe(200);

      makeReset('rst-revoke');
      await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'rst-revoke', password: 'the-new-password' } });

      const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
      expect(after.statusCode).toBe(401);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect pass** (route implemented in Task 3.4).
  ```bash
  npm test -w server -- auth-reset
  ```
  Expected: `Test Files 1 passed`, `Tests 5 passed`.

  If any assertion fails, fix `reset-password` in `server/src/routes/auth.ts`, then re-run until green.

- [ ] **Step 3: Commit.**
  ```bash
  git add server/test/auth-reset.test.ts && git commit -m "$(cat <<'EOF'
  test: reset-password flows (single-use, expiry, session revocation)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3.7: Auth hardening — deactivated login, session invalidation, rate limiting

Files: `server/test/auth-hardening.test.ts` (behavior implemented in Tasks 3.2/3.4; driven failing-first here).

Deactivation state is set directly in the DB here (the admin `PATCH /api/admin/members/:id` route is Section 7); this keeps the test independent of later sections.

- [ ] **Step 1: Write the failing test** `server/test/auth-hardening.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import type { FastifyInstance } from 'fastify';
  import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
  import { eq } from 'drizzle-orm';
  import { makeApp, seedUser, login } from './helpers.js';
  import * as schema from '../src/db/schema.js';

  type Db = BetterSQLite3Database<typeof schema>;

  let app: FastifyInstance;
  let db: Db;
  let userId: string;

  beforeEach(() => {
    const ctx = makeApp();
    app = ctx.app;
    db = ctx.db;
    userId = seedUser(db, { email: 'dee@x.com', name: 'Dee', password: 'her-password' }).id;
  });

  function deactivate() {
    db.update(schema.users).set({ deactivatedAt: new Date().toISOString() }).where(eq(schema.users.id, userId)).run();
  }

  describe('deactivated users', () => {
    it('cannot log in (generic 401)', async () => {
      deactivate();
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dee@x.com', password: 'her-password' } });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid email or password');
    });

    it('have their existing session rejected on the next request', async () => {
      const cookie = await login(app, 'dee@x.com', 'her-password');
      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(200);
      deactivate();
      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
    });
  });

  describe('login rate limiting', () => {
    it('returns 429 after 10 attempts per IP in the window', async () => {
      const attempt = () => app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'dee@x.com', password: 'wrong' } });
      for (let i = 0; i < 10; i++) {
        const res = await attempt();
        expect(res.statusCode).toBe(401);
      }
      const eleventh = await attempt();
      expect(eleventh.statusCode).toBe(429);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect pass** (deactivation guard is in `login` and `requireAuth`; rate-limit is on the login route).
  ```bash
  npm test -w server -- auth-hardening
  ```
  Expected: `Test Files 1 passed`, `Tests 3 passed`.

  If the rate-limit assertion fails with all 11 returning 401, the `@fastify/rate-limit` `onRoute` hook is not seeing the login route — confirm `app.ts` registers `rateLimit` inside the awaited encapsulated plugin *before* `registerAuthRoutes(instance)` (Task 3.4, Step 5). If deactivated login returns 200, confirm the `user.deactivatedAt !== null` guard is present in the `login` handler.

- [ ] **Step 3: Run the full server suite** to confirm nothing regressed.
  ```bash
  npm test -w server
  ```
  Expected: all Section 3 files green — `Test Files 7 passed`, `Tests 35 passed` (passwords 3, perms 9, bootstrap 3, auth-login 6, auth-invite 6, auth-reset 5, auth-hardening 3), plus any Section 1/2 suites.

- [ ] **Step 4: Commit.**
  ```bash
  git add server/test/auth-hardening.test.ts && git commit -m "$(cat <<'EOF'
  test: deactivated-user login/session guards and login rate limiting

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Artifacts exported for later sections

- `server/src/lib/perms.ts`: `requireAuth`, `requireAdmin` (Fastify preHandlers), `canAccessBoard(db, userId, boardId)`, `toUserPublic`, `toMe`, `randomAvatarColor`, `createSession`, `revokeSession`, `revokeUserSessions`, `setSessionCookie`, `SESSION_COOKIE`.
- `server/src/app.ts`: `buildApp(deps: AppDeps)`, `AppDeps`, `Emit`, and the Fastify module augmentation (`FastifyInstance.db/dataDir/emit`, `FastifyRequest.user`). Sections 4–7 add their `registerXRoutes(app)` calls to `buildApp` after the auth block, using `request.server.db`, `request.server.emit`, `request.user`, and the `requireAuth`/`requireAdmin` preHandlers.
- `server/test/helpers.ts`: `makeApp()`, `seedUser(db, {...})`, `login(app, email, password)`.
- `server/src/lib/passwords.ts`: `hashPassword`, `verifyPassword` (used by users/admin routes).


---

## Section 4: Boards API: CRUD, members, stars, labels, archive/restore, board detail

This section owns `server/src/routes/boards.ts` and the `server/src/lib/activity.ts` logging helper, and turns `server/src/app.ts` (from Section 3) into a `RouteCtx`-based route host so Sections 5–7 can append their route modules. Every board-content mutation writes an `activity` row (via `logActivity`) and calls `emit.boardChanged(boardId, req.user.id)`.

### Preconditions (artifacts from Sections 1–3 — use verbatim, do NOT redefine)

- `shared/types.ts` complete; import DTOs from `@shared/types`: `BoardSummary`, `BoardDetail`, `CardDto`, `ChecklistItemDto`, `Label`, `LabelColor`, `ListDto`, `UserPublic`.
- `server/src/db/schema.ts` exports Drizzle tables (camelCase columns): `users`, `boards`, `boardMembers`, `lists`, `cards`, `cardAssignees`, `labels`, `cardLabels`, `checklistItems`, `comments`, `attachments`, `activity`, `notifications`. `boardMembers` PK is `(boardId, userId)` with `starred` (default false). `activity` has `boardId` (FK boards), `cardId` (nullable FK cards), `actorId`, `type` (text), `data` (text JSON), `createdAt`. FK enforcement is ON (`createDb` sets `PRAGMA foreign_keys = ON`), so cascade delete removes `card_labels` when a label is deleted.
- `server/src/db/index.ts` → `createDb(path | ':memory:') → { db, sqlite }` (migrations applied).
- `server/src/lib/perms.ts` → `requireAuth` (Fastify preHandler; 401s and sets `req.user: Me`; **also 401s a deactivated user's session**), `canAccessBoard(db, userId, boardId): boolean` (**synchronous**; admins pass any board, team boards pass any active user, private boards require a `board_members` row), `toUserPublic(row): UserPublic`.
- `server/src/app.ts` (Section 3) exports `buildApp(deps: AppDeps): FastifyInstance`, `interface AppDeps { db; dataDir; emit }`, `interface Emit { boardChanged(boardId, byUserId): void }`, and the Fastify module augmentation (`FastifyInstance.db/dataDir/emit`, `FastifyRequest.user`). Its body decorates `db`/`dataDir`/`emit`, registers `@fastify/cookie`, and registers auth routes inside an awaited encapsulated rate-limit plugin. This section adds `export type RouteCtx = AppDeps;` and `registerBoardRoutes(app, ctx)` after the auth block.
- `server/test/helpers.ts` → `makeApp(): { app, db }` (no-op `emit`), `seedUser(db, { email, name, password, isAdmin? }) → { id, email, name, isAdmin }`, `login(app, email, password): Promise<string>` (cookie header value).

### Route ownership boundary

This section owns: `GET /api/boards`, `POST /api/boards`, `GET/PATCH/DELETE /api/boards/:id`, `POST /api/boards/:id/star`, `POST/DELETE /api/boards/:id/members(/:userId)`, `GET /api/boards/:id/archived`, `POST /api/boards/:id/restore`, `POST /api/boards/:id/labels`, `PATCH/DELETE /api/labels/:id`. It does NOT own list/card routes (Section 5) or admin/board-recovery routes (Section 7 owns `/api/admin/*` including archived-**board** recovery and purge). This section's `/restore` handles archived **lists and cards** within an active board only (`entity: 'list' | 'card'`).

### Design decisions (intentional)

- **`GET /api/boards` listing** returns non-archived boards where `visibility = 'team'` OR the user has a `board_members` row. Admins are **not** special-cased in the *listing* (their home stays focused on their own boards); an admin still *accesses* any private board via `GET /api/boards/:id` (gated by `canAccessBoard`). Listing and access are deliberately separate. Client-side sort (starred/team/private) is Section 9's concern.
- **Access failures return 403** when the board exists but the user lacks access, and **404** when the board is missing or archived — consistent with Section 5's route error codes.
- **`memberCount`** = count of `board_members` rows; **`cardCount`** = count of non-archived cards; **`starred`** = the current user's `board_members.starred`. Board reads order lists/cards by SQL `ORDER BY (position, id)` (BINARY collation), matching the client's `(position, id)` sort and Section 5's tie-break test.
- **Board-content mutation** = create, patch, archive, restore, star, member add/remove, label create/rename/delete. Each writes an `activity` row and emits `boardChanged`. (Board-level activity has `cardId = null`; nothing renders it in v1, but the spec requires "every change writes an activity row" and `logActivity` is cheap and reused by Section 5.)

### Files

**Create**
- `server/src/lib/activity.ts` — `logActivity(db, { boardId, cardId?, actorId, type, data })`
- `server/src/routes/boards.ts` — `registerBoardRoutes(app, ctx)` (all board/label routes)

**Modify**
- `server/src/app.ts` — export `RouteCtx`; build `ctx`; call `registerBoardRoutes(app, ctx)`

**Test**
- `server/test/activity.test.ts`
- `server/test/boards-create.test.ts`
- `server/test/boards-list.test.ts`
- `server/test/boards-patch.test.ts`
- `server/test/boards-star.test.ts`
- `server/test/boards-members.test.ts`
- `server/test/boards-labels.test.ts`
- `server/test/boards-archived.test.ts`
- `server/test/boards-perms.test.ts`

---

### Task 4.1: Activity logging helper (`logActivity`)

Files: create `server/src/lib/activity.ts`; create `server/test/activity.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/activity.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/index';
import { logActivity } from '../src/lib/activity';
import { activity, boards, users } from '../src/db/schema';

function seed() {
  const { db } = createDb(':memory:');
  const now = new Date().toISOString();
  db.insert(users)
    .values({ id: 'u1', email: 'a@x.com', name: 'A', passwordHash: 'x', avatarColor: 'coral', isAdmin: false, emailNotifications: true, deactivatedAt: null, createdAt: now })
    .run();
  db.insert(boards)
    .values({ id: 'b1', name: 'B', accentColor: 'coral', visibility: 'team', createdBy: 'u1', archivedAt: null, createdAt: now })
    .run();
  return db;
}

describe('logActivity', () => {
  it('inserts a row, serializes data to JSON, and defaults cardId to null', () => {
    const db = seed();
    logActivity(db, { boardId: 'b1', actorId: 'u1', type: 'board.created', data: { name: 'B' } });
    const rows = db.select().from(activity).where(eq(activity.boardId, 'b1')).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('board.created');
    expect(rows[0].actorId).toBe('u1');
    expect(rows[0].cardId).toBeNull();
    expect(JSON.parse(rows[0].data)).toEqual({ name: 'B' });
    expect(typeof rows[0].createdAt).toBe('string');
  });

  it('appends a second row on a second call', () => {
    const db = seed();
    logActivity(db, { boardId: 'b1', actorId: 'u1', type: 'board.renamed', data: {} });
    logActivity(db, { boardId: 'b1', actorId: 'u1', type: 'board.archived', data: {} });
    expect(db.select().from(activity).where(eq(activity.boardId, 'b1')).all()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- activity` → expected: FAIL — `Failed to resolve import "../src/lib/activity"` (0 tests collected), exit code 1.

- [ ] **Step 3: Create `server/src/lib/activity.ts` with full contents.**

```ts
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export function logActivity(
  db: Db,
  entry: { boardId: string; cardId?: string | null; actorId: string; type: string; data: Record<string, unknown> },
): void {
  db.insert(schema.activity)
    .values({
      id: nanoid(12),
      boardId: entry.boardId,
      cardId: entry.cardId ?? null,
      actorId: entry.actorId,
      type: entry.type,
      data: JSON.stringify(entry.data),
      createdAt: new Date().toISOString(),
    })
    .run();
}
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- activity` → expected: 2 passed.

- [ ] **Step 5: Commit.**

```
git add server/src/lib/activity.ts server/test/activity.test.ts && git commit -m "feat: logActivity helper (JSON-serialized activity rows)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.2: Board create + GET board detail (helpers + app wiring)

Introduces `server/src/routes/boards.ts` with the shared serializers (`toLabel`, `boardMembersList`, `cardToDto`, `boardSummary`, `buildBoardDetail`), the `POST /api/boards` and `GET /api/boards/:id` routes, and a `// BOARD_ROUTES_APPEND` sentinel that later tasks replace. Wires `RouteCtx` + `registerBoardRoutes(app, ctx)` into `server/src/app.ts`.

**Files:** create `server/src/routes/boards.ts`; modify `server/src/app.ts`; create `server/test/boards-create.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-create.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';
import { lists } from '../src/db/schema';

const COLORS = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

async function setup() {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  return { app, db, admin, cookie };
}

describe('POST /api/boards', () => {
  it('creates a board, seeds 8 blank labels, adds the creator as member, returns BoardDetail', async () => {
    const { app, admin, cookie } = await setup();
    const res = await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Sprint', visibility: 'team', accentColor: 'coral' } });
    expect(res.statusCode).toBe(201);
    const detail = res.json();
    expect(detail.board.name).toBe('Sprint');
    expect(detail.board.visibility).toBe('team');
    expect(detail.board.accentColor).toBe('coral');
    expect(detail.board.starred).toBe(false);
    expect(detail.board.cardCount).toBe(0);
    expect(detail.board.memberCount).toBe(1);
    expect(detail.board.members).toHaveLength(1);
    expect(detail.board.members[0].id).toBe(admin.id);
    expect(detail.lists).toEqual([]);
    expect(detail.cards).toEqual([]);
    expect(detail.labels).toHaveLength(8);
    expect(detail.labels.every((l: { name: string }) => l.name === '')).toBe(true);
    expect(new Set(detail.labels.map((l: { color: string }) => l.color))).toEqual(new Set(COLORS));
  });

  it('rejects a bad accentColor, a bad visibility, and an empty name', async () => {
    const { app, cookie } = await setup();
    const badColor = await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'X', visibility: 'team', accentColor: 'chartreuse' } });
    expect(badColor.statusCode).toBe(400);
    const badVis = await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'X', visibility: 'secret', accentColor: 'coral' } });
    expect(badVis.statusCode).toBe(400);
    const badName = await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: '  ', visibility: 'team', accentColor: 'coral' } });
    expect(badName.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'POST', url: '/api/boards', payload: { name: 'X', visibility: 'team', accentColor: 'coral' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/boards/:id', () => {
  it('returns the board detail with lists ordered by (position, id)', async () => {
    const { app, db, cookie } = await setup();
    const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'B', visibility: 'team', accentColor: 'blue' } })).json().board.id;
    db.insert(lists).values({ id: 'l-hi', boardId, name: 'Second', position: 'a1', archivedAt: null }).run();
    db.insert(lists).values({ id: 'l-lo', boardId, name: 'First', position: 'a0', archivedAt: null }).run();
    const res = await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().lists.map((l: { name: string }) => l.name)).toEqual(['First', 'Second']);
  });

  it('404s an unknown board', async () => {
    const { app, cookie } = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/boards/missing', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-create` → expected: FAIL — routes return 404 (POST/GET not registered yet), so the create/detail assertions fail.

- [ ] **Step 3: Create `server/src/routes/boards.ts` with full contents.** (Later tasks append routes at the `// BOARD_ROUTES_APPEND` sentinel — keep it exactly as written.)

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { BoardDetail, BoardSummary, CardDto, ChecklistItemDto, Label, LabelColor, ListDto, UserPublic } from '@shared/types';
import type { RouteCtx } from '../app';
import { attachments, boardMembers, boards, cardAssignees, cardLabels, cards, checklistItems, comments, labels, lists, users } from '../db/schema';
import { canAccessBoard, requireAuth, toUserPublic } from '../lib/perms';
import { logActivity } from '../lib/activity';

type Db = RouteCtx['db'];

const labelColorSchema = z.enum(['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray']);

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  visibility: z.enum(['team', 'private']),
  accentColor: labelColorSchema,
});

function toLabel(row: typeof labels.$inferSelect): Label {
  return { id: row.id, boardId: row.boardId, name: row.name, color: row.color as LabelColor };
}

function boardMembersList(db: Db, boardId: string): UserPublic[] {
  return db
    .select()
    .from(boardMembers)
    .where(eq(boardMembers.boardId, boardId))
    .all()
    .map((m) => db.select().from(users).where(eq(users.id, m.userId)).get())
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map(toUserPublic);
}

function cardToDto(db: Db, card: typeof cards.$inferSelect): CardDto {
  const assigneeIds = db.select().from(cardAssignees).where(eq(cardAssignees.cardId, card.id)).all().map((r) => r.userId);
  const labelIds = db.select().from(cardLabels).where(eq(cardLabels.cardId, card.id)).all().map((r) => r.labelId);
  const checklist: ChecklistItemDto[] = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, card.id))
    .orderBy(asc(checklistItems.position), asc(checklistItems.id))
    .all()
    .map((r) => ({ id: r.id, cardId: r.cardId, text: r.text, done: r.done, position: r.position }));
  const attachmentCount = db.select().from(attachments).where(eq(attachments.cardId, card.id)).all().length;
  const commentCount = db.select().from(comments).where(eq(comments.cardId, card.id)).all().length;
  return {
    id: card.id,
    listId: card.listId,
    boardId: card.boardId,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate,
    position: card.position,
    archivedAt: card.archivedAt,
    createdBy: card.createdBy,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    assigneeIds,
    labelIds,
    checklist,
    attachmentCount,
    commentCount,
  };
}

function boardSummary(db: Db, board: typeof boards.$inferSelect, userId: string): BoardSummary {
  const membership = db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, board.id), eq(boardMembers.userId, userId)))
    .get();
  const cardCount = db.select().from(cards).where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt))).all().length;
  const memberCount = db.select().from(boardMembers).where(eq(boardMembers.boardId, board.id)).all().length;
  return {
    id: board.id,
    name: board.name,
    accentColor: board.accentColor as LabelColor,
    visibility: board.visibility,
    starred: membership?.starred ?? false,
    cardCount,
    memberCount,
    archivedAt: board.archivedAt,
  };
}

function buildBoardDetail(db: Db, board: typeof boards.$inferSelect, userId: string): BoardDetail {
  const summary = boardSummary(db, board, userId);
  const members = boardMembersList(db, board.id);
  const boardLists: ListDto[] = db
    .select()
    .from(lists)
    .where(and(eq(lists.boardId, board.id), isNull(lists.archivedAt)))
    .orderBy(asc(lists.position), asc(lists.id))
    .all()
    .map((l) => ({ id: l.id, boardId: l.boardId, name: l.name, position: l.position, archivedAt: l.archivedAt }));
  const boardCards: CardDto[] = db
    .select()
    .from(cards)
    .where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.id))
    .all()
    .map((c) => cardToDto(db, c));
  const boardLabels: Label[] = db.select().from(labels).where(eq(labels.boardId, board.id)).all().map(toLabel);
  return { board: { ...summary, members }, lists: boardLists, cards: boardCards, labels: boardLabels };
}

export function registerBoardRoutes(app: FastifyInstance, ctx: RouteCtx) {
  const { db, emit } = ctx;

  app.post('/api/boards', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const now = new Date().toISOString();
    const boardId = nanoid(12);
    db.insert(boards).values({
      id: boardId,
      name: parsed.data.name,
      accentColor: parsed.data.accentColor,
      visibility: parsed.data.visibility,
      createdBy: req.user.id,
      archivedAt: null,
      createdAt: now,
    }).run();
    db.insert(boardMembers).values({ boardId, userId: req.user.id, starred: false }).run();
    for (const color of labelColorSchema.options) {
      db.insert(labels).values({ id: nanoid(12), boardId, name: '', color }).run();
    }
    logActivity(db, { boardId, actorId: req.user.id, type: 'board.created', data: { name: parsed.data.name } });
    emit.boardChanged(boardId, req.user.id);
    const board = db.select().from(boards).where(eq(boards.id, boardId)).get()!;
    return reply.code(201).send(buildBoardDetail(db, board, req.user.id));
  });

  app.get('/api/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });
    return reply.send(buildBoardDetail(db, board, req.user.id));
  });

  // BOARD_ROUTES_APPEND
}
```

- [ ] **Step 4: Wire the module into `server/src/app.ts` with three surgical edits.**

  Edit 1 — add the import directly below the existing `import { registerAuthRoutes } from './routes/auth.js';` line:

  ```ts
  import { registerBoardRoutes } from './routes/boards';
  ```

  Edit 2 — add the `RouteCtx` export directly below the closing brace of the `AppDeps` interface (Sections 5–7 import this type):

  ```ts
  export type RouteCtx = AppDeps;
  ```

  Edit 3 — inside `buildApp`, replace this block:

  ```ts
    app.register(async (instance) => {
      await instance.register(rateLimit, { global: false });
      registerAuthRoutes(instance);
    });

    return app;
  ```

  with:

  ```ts
    app.register(async (instance) => {
      await instance.register(rateLimit, { global: false });
      registerAuthRoutes(instance);
    });

    const ctx: RouteCtx = { db: deps.db, dataDir: deps.dataDir, emit: deps.emit };
    registerBoardRoutes(app, ctx);

    return app;
  ```

  Board routes register directly on `app` (not inside the encapsulated rate-limit plugin — only login is rate-limited). `@fastify/cookie` is registered on `app` beforehand and applies globally (fastify-plugin, non-encapsulated), so `req.cookies` / `requireAuth` work for these routes.

- [ ] **Step 5: Run and confirm pass.** `npm test -w server -- boards-create` → expected: 5 passed.

- [ ] **Step 6: Commit.**

```
git add server/src/routes/boards.ts server/src/app.ts server/test/boards-create.test.ts && git commit -m "feat: board create + GET board detail; RouteCtx app wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.3: List visible boards (`GET /api/boards`)

Returns non-archived boards where visibility is `team` OR the user is a `board_members` row — with `cardCount`, `memberCount`, and per-user `starred`. Admin is not special-cased in the listing.

**Files:** modify `server/src/routes/boards.ts` (append at sentinel); create `server/test/boards-list.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-list.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const bob = seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'pw123456', isAdmin: false });
  const adminCookie = await login(app, 'a@x.com', 'pw123456');
  const bobCookie = await login(app, 'b@x.com', 'pw123456');
  return { app, db, admin, bob, adminCookie, bobCookie };
}

function createBoard(app: Awaited<ReturnType<typeof setup>>['app'], cookie: string, name: string, visibility: 'team' | 'private') {
  return app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name, visibility, accentColor: 'coral' } });
}

describe('GET /api/boards', () => {
  it('lists team boards for everyone and private boards only for members', async () => {
    const { app, adminCookie, bobCookie } = await setup();
    const team = (await createBoard(app, adminCookie, 'Team', 'team')).json().board.id;
    const priv = (await createBoard(app, adminCookie, 'Private', 'private')).json().board.id;

    const adminList = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: adminCookie } })).json();
    expect(adminList.map((b: { id: string }) => b.id).sort()).toEqual([team, priv].sort());

    const bobList = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: bobCookie } })).json();
    expect(bobList.map((b: { id: string }) => b.id)).toEqual([team]);
  });

  it('does not list another user\'s private board, even for an admin (listing != access)', async () => {
    const { app, adminCookie, bobCookie } = await setup();
    const bobPriv = (await createBoard(app, bobCookie, 'BobPriv', 'private')).json().board.id;
    const adminList = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: adminCookie } })).json();
    expect(adminList.map((b: { id: string }) => b.id)).not.toContain(bobPriv);
  });

  it('excludes archived boards from the list', async () => {
    const { app, db, adminCookie } = await setup();
    const team = (await createBoard(app, adminCookie, 'Team', 'team')).json().board.id;
    const { boards } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    db.update(boards).set({ archivedAt: new Date().toISOString() }).where(eq(boards.id, team)).run();
    const list = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: adminCookie } })).json();
    expect(list.map((b: { id: string }) => b.id)).not.toContain(team);
  });

  it('reports cardCount and memberCount', async () => {
    const { app, db, adminCookie } = await setup();
    const boardId = (await createBoard(app, adminCookie, 'Counts', 'team')).json().board.id;
    const { cards, lists } = await import('../src/db/schema');
    const now = new Date().toISOString();
    db.insert(lists).values({ id: 'l1', boardId, name: 'L', position: 'a0', archivedAt: null }).run();
    const admin = (await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: adminCookie } })).json();
    db.insert(cards).values({ id: 'c1', listId: 'l1', boardId, title: 'One', description: '', dueDate: null, position: 'a0', archivedAt: null, createdBy: admin.id, createdAt: now, updatedAt: now }).run();
    db.insert(cards).values({ id: 'c2', listId: 'l1', boardId, title: 'Two', description: '', dueDate: null, position: 'a1', archivedAt: null, createdBy: admin.id, createdAt: now, updatedAt: now }).run();
    const list = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: adminCookie } })).json();
    const summary = list.find((b: { id: string }) => b.id === boardId);
    expect(summary.cardCount).toBe(2);
    expect(summary.memberCount).toBe(1);
    expect(summary.starred).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-list` → expected: FAIL (4 failed) — `GET /api/boards` returns 404 (route not registered), so `.json()` is not an array and the assertions throw. (Every test archives/counts via direct `db` writes, so this file depends only on the list route added below.)

- [ ] **Step 3: Append the list handler.** Replace the sentinel `  // BOARD_ROUTES_APPEND` in `server/src/routes/boards.ts` with:

```ts
  app.get('/api/boards', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.user.id;
    const visible = db
      .select()
      .from(boards)
      .where(isNull(boards.archivedAt))
      .all()
      .filter((b) => {
        if (b.visibility === 'team') return true;
        return !!db
          .select()
          .from(boardMembers)
          .where(and(eq(boardMembers.boardId, b.id), eq(boardMembers.userId, userId)))
          .get();
      });
    return reply.send(visible.map((b) => boardSummary(db, b, userId)));
  });

  // BOARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- boards-list` → expected: 4 passed.

- [ ] **Step 5: Commit.**

```
git add server/src/routes/boards.ts server/test/boards-list.test.ts && git commit -m "feat: GET /api/boards (visible, non-archived, counts, starred)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.4: Update board (`PATCH`) + archive (`DELETE`)

**Files:** modify `server/src/routes/boards.ts` (append at sentinel); create `server/test/boards-patch.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-patch.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'B', visibility: 'team', accentColor: 'coral' } })).json().board.id;
  return { app, db, cookie, boardId };
}

describe('PATCH /api/boards/:id', () => {
  it('renames, changes visibility, and recolors', async () => {
    const { app, cookie, boardId } = await setup();
    const renamed = await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie }, payload: { name: 'Renamed' } });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Renamed');
    await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie }, payload: { visibility: 'private', accentColor: 'blue' } });
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.board.visibility).toBe('private');
    expect(detail.board.accentColor).toBe('blue');
  });

  it('rejects a bad accentColor and an empty patch', async () => {
    const { app, cookie, boardId } = await setup();
    const bad = await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie }, payload: { accentColor: 'chartreuse' } });
    expect(bad.statusCode).toBe(400);
    const empty = await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie }, payload: {} });
    expect(empty.statusCode).toBe(400);
  });

  it('404s an unknown board', async () => {
    const { app, cookie } = await setup();
    const res = await app.inject({ method: 'PATCH', url: '/api/boards/missing', headers: { cookie }, payload: { name: 'X' } });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/boards/:id (archive)', () => {
  it('archives the board so detail 404s and it drops out of the list', async () => {
    const { app, cookie, boardId } = await setup();
    const del = await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    const detail = await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } });
    expect(detail.statusCode).toBe(404);
    const list = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie } })).json();
    expect(list.map((b: { id: string }) => b.id)).not.toContain(boardId);
  });

  it('404s PATCH and DELETE on an already-archived board', async () => {
    const { app, cookie, boardId } = await setup();
    await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie } });
    const patch = await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie }, payload: { name: 'X' } });
    expect(patch.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie } });
    expect(del.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-patch` → expected: FAIL — PATCH/DELETE return 404 (routes not registered).

- [ ] **Step 3: Append the PATCH + DELETE handlers.** Replace the sentinel `  // BOARD_ROUTES_APPEND` in `server/src/routes/boards.ts` with:

```ts
  const patchBoardSchema = z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      visibility: z.enum(['team', 'private']).optional(),
      accentColor: labelColorSchema.optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.patch('/api/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchBoardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof boards.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility;
    if (parsed.data.accentColor !== undefined) patch.accentColor = parsed.data.accentColor;
    db.update(boards).set(patch).where(eq(boards.id, id)).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.updated', data: parsed.data });
    emit.boardChanged(id, req.user.id);
    const updated = db.select().from(boards).where(eq(boards.id, id)).get()!;
    return reply.send(boardSummary(db, updated, req.user.id));
  });

  app.delete('/api/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });
    db.update(boards).set({ archivedAt: new Date().toISOString() }).where(eq(boards.id, id)).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.archived', data: { name: board.name } });
    emit.boardChanged(id, req.user.id);
    return reply.code(204).send();
  });

  // BOARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- boards-patch` → expected: 5 passed.

- [ ] **Step 5: Commit.**

```
git add server/src/routes/boards.ts server/test/boards-patch.test.ts && git commit -m "feat: PATCH board (name/visibility/accent) + DELETE archive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.5: Star / unstar a board (`POST /api/boards/:id/star`)

Upserts the current user's `board_members` row with the given `starred` flag. A non-member starring a team board creates their membership row (which is why `memberCount` can grow).

**Files:** modify `server/src/routes/boards.ts` (append at sentinel); create `server/test/boards-star.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-star.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'pw123456', isAdmin: false });
  const adminCookie = await login(app, 'a@x.com', 'pw123456');
  const bobCookie = await login(app, 'b@x.com', 'pw123456');
  const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie: adminCookie }, payload: { name: 'B', visibility: 'team', accentColor: 'coral' } })).json().board.id;
  return { app, db, adminCookie, bobCookie, boardId };
}

describe('POST /api/boards/:id/star', () => {
  it('stars then unstars for the current user', async () => {
    const { app, adminCookie, boardId } = await setup();
    const starred = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/star`, headers: { cookie: adminCookie }, payload: { starred: true } });
    expect(starred.statusCode).toBe(200);
    expect(starred.json().starred).toBe(true);
    const list = (await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: adminCookie } })).json();
    expect(list.find((b: { id: string }) => b.id === boardId).starred).toBe(true);

    const unstarred = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/star`, headers: { cookie: adminCookie }, payload: { starred: false } });
    expect(unstarred.json().starred).toBe(false);
  });

  it('a non-member starring a team board creates their membership row', async () => {
    const { app, bobCookie, boardId } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/star`, headers: { cookie: bobCookie }, payload: { starred: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json().starred).toBe(true);
    expect(res.json().memberCount).toBe(2);
  });

  it('rejects a missing starred flag with 400', async () => {
    const { app, adminCookie, boardId } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/star`, headers: { cookie: adminCookie }, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-star` → expected: FAIL — the star route returns 404 (not registered).

- [ ] **Step 3: Append the star handler.** Replace the sentinel `  // BOARD_ROUTES_APPEND` in `server/src/routes/boards.ts` with:

```ts
  const starSchema = z.object({ starred: z.boolean() });

  app.post('/api/boards/:id/star', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = starSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    db.insert(boardMembers)
      .values({ boardId: id, userId: req.user.id, starred: parsed.data.starred })
      .onConflictDoUpdate({ target: [boardMembers.boardId, boardMembers.userId], set: { starred: parsed.data.starred } })
      .run();
    emit.boardChanged(id, req.user.id);
    return reply.send(boardSummary(db, board, req.user.id));
  });

  // BOARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- boards-star` → expected: 3 passed.

- [ ] **Step 5: Commit.**

```
git add server/src/routes/boards.ts server/test/boards-star.test.ts && git commit -m "feat: star/unstar board (board_members upsert)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.6: Board members add / remove

`POST /api/boards/:id/members {userId}` and `DELETE /api/boards/:id/members/:userId`. Both return the board's members as `UserPublic[]`. Adding a member to a private board grants that user access.

**Files:** modify `server/src/routes/boards.ts` (append at sentinel); create `server/test/boards-members.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-members.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeApp, seedUser, login } from './helpers';
import { users } from '../src/db/schema';

async function setup() {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const bob = seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'pw123456', isAdmin: false });
  const adminCookie = await login(app, 'a@x.com', 'pw123456');
  const bobCookie = await login(app, 'b@x.com', 'pw123456');
  const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie: adminCookie }, payload: { name: 'B', visibility: 'private', accentColor: 'coral' } })).json().board.id;
  return { app, db, admin, bob, adminCookie, bobCookie, boardId };
}

describe('board members', () => {
  it('adds a member (granting private-board access) and removes them (revoking it)', async () => {
    const { app, bob, adminCookie, bobCookie, boardId } = await setup();
    expect((await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie } })).statusCode).toBe(403);

    const added = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/members`, headers: { cookie: adminCookie }, payload: { userId: bob.id } });
    expect(added.statusCode).toBe(200);
    expect(added.json()).toHaveLength(2);
    expect(added.json().some((u: { id: string }) => u.id === bob.id)).toBe(true);
    expect((await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie } })).statusCode).toBe(200);

    const removed = await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}/members/${bob.id}`, headers: { cookie: adminCookie } });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().some((u: { id: string }) => u.id === bob.id)).toBe(false);
    expect((await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie } })).statusCode).toBe(403);
  });

  it('adding is idempotent (no duplicate membership row)', async () => {
    const { app, bob, adminCookie, boardId } = await setup();
    await app.inject({ method: 'POST', url: `/api/boards/${boardId}/members`, headers: { cookie: adminCookie }, payload: { userId: bob.id } });
    const again = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/members`, headers: { cookie: adminCookie }, payload: { userId: bob.id } });
    expect(again.statusCode).toBe(200);
    expect(again.json().filter((u: { id: string }) => u.id === bob.id)).toHaveLength(1);
  });

  it('rejects an unknown user and a deactivated user with 400', async () => {
    const { app, db, bob, adminCookie, boardId } = await setup();
    const unknown = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/members`, headers: { cookie: adminCookie }, payload: { userId: 'ghost' } });
    expect(unknown.statusCode).toBe(400);
    db.update(users).set({ deactivatedAt: new Date().toISOString() }).where(eq(users.id, bob.id)).run();
    const deactivated = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/members`, headers: { cookie: adminCookie }, payload: { userId: bob.id } });
    expect(deactivated.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-members` → expected: FAIL — the member routes return 404 (not registered).

- [ ] **Step 3: Append the member handlers.** Replace the sentinel `  // BOARD_ROUTES_APPEND` in `server/src/routes/boards.ts` with:

```ts
  const addMemberSchema = z.object({ userId: z.string().min(1) });

  app.post('/api/boards/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });
    const target = db.select().from(users).where(eq(users.id, parsed.data.userId)).get();
    if (!target || target.deactivatedAt !== null) return reply.code(400).send({ error: 'user not found' });

    db.insert(boardMembers).values({ boardId: id, userId: target.id, starred: false }).onConflictDoNothing().run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.member_added', data: { userId: target.id } });
    emit.boardChanged(id, req.user.id);
    return reply.send(boardMembersList(db, id));
  });

  app.delete('/api/boards/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(boardMembers).where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, userId))).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'board.member_removed', data: { userId } });
    emit.boardChanged(id, req.user.id);
    return reply.send(boardMembersList(db, id));
  });

  // BOARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- boards-members` → expected: 3 passed.

- [ ] **Step 5: Commit.**

```
git add server/src/routes/boards.ts server/test/boards-members.test.ts && git commit -m "feat: board member add/remove (grants/revokes private access)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.7: Labels create / rename / delete

`POST /api/boards/:id/labels {name?,color}`, `PATCH /api/labels/:id {name?,color?}`, `DELETE /api/labels/:id`. Delete removes the label's `card_labels` rows (verified by direct `db` inserts, since Section 5 owns the card-label attach route).

**Files:** modify `server/src/routes/boards.ts` (append at sentinel); create `server/test/boards-labels.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-labels.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeApp, seedUser, login } from './helpers';
import { cardLabels, cards, lists } from '../src/db/schema';

async function setup() {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'B', visibility: 'team', accentColor: 'coral' } })).json();
  return { app, db, admin, cookie, boardId: board.board.id, seededLabelId: board.labels[0].id };
}

describe('labels', () => {
  it('creates a label (name optional) and lists it on the board', async () => {
    const { app, cookie, boardId } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/labels`, headers: { cookie }, payload: { name: 'Urgent', color: 'coral' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Urgent', color: 'coral', boardId });
    const noName = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/labels`, headers: { cookie }, payload: { color: 'blue' } });
    expect(noName.json().name).toBe('');
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.labels).toHaveLength(10);
  });

  it('renames and recolors a label', async () => {
    const { app, cookie, seededLabelId } = await setup();
    const res = await app.inject({ method: 'PATCH', url: `/api/labels/${seededLabelId}`, headers: { cookie }, payload: { name: 'Bug', color: 'blue' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: seededLabelId, name: 'Bug', color: 'blue' });
  });

  it('deletes a label and detaches it from all cards', async () => {
    const { app, db, admin, cookie, boardId, seededLabelId } = await setup();
    const now = new Date().toISOString();
    db.insert(lists).values({ id: 'l1', boardId, name: 'L', position: 'a0', archivedAt: null }).run();
    db.insert(cards).values({ id: 'c1', listId: 'l1', boardId, title: 'C', description: '', dueDate: null, position: 'a0', archivedAt: null, createdBy: admin.id, createdAt: now, updatedAt: now }).run();
    db.insert(cardLabels).values({ cardId: 'c1', labelId: seededLabelId }).run();

    const del = await app.inject({ method: 'DELETE', url: `/api/labels/${seededLabelId}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    expect(db.select().from(cardLabels).where(eq(cardLabels.labelId, seededLabelId)).all()).toHaveLength(0);
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.labels.some((l: { id: string }) => l.id === seededLabelId)).toBe(false);
  });

  it('rejects a bad color on create and 404s an unknown label on patch', async () => {
    const { app, cookie, boardId } = await setup();
    const bad = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/labels`, headers: { cookie }, payload: { color: 'chartreuse' } });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({ method: 'PATCH', url: '/api/labels/missing', headers: { cookie }, payload: { name: 'X' } });
    expect(missing.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-labels` → expected: FAIL — the label routes return 404 (not registered).

- [ ] **Step 3: Append the label handlers.** Replace the sentinel `  // BOARD_ROUTES_APPEND` in `server/src/routes/boards.ts` with:

```ts
  const createLabelSchema = z.object({ name: z.string().trim().max(50).optional(), color: labelColorSchema });
  const patchLabelSchema = z
    .object({ name: z.string().trim().max(50).optional(), color: labelColorSchema.optional() })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.post('/api/boards/:id/labels', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    const labelId = nanoid(12);
    db.insert(labels).values({ id: labelId, boardId: id, name: parsed.data.name ?? '', color: parsed.data.color }).run();
    logActivity(db, { boardId: id, actorId: req.user.id, type: 'label.created', data: { labelId } });
    emit.boardChanged(id, req.user.id);
    return reply.code(201).send(toLabel(db.select().from(labels).where(eq(labels.id, labelId)).get()!));
  });

  app.patch('/api/labels/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchLabelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const label = db.select().from(labels).where(eq(labels.id, id)).get();
    if (!label) return reply.code(404).send({ error: 'label not found' });
    if (!canAccessBoard(db, req.user.id, label.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof labels.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.color !== undefined) patch.color = parsed.data.color;
    db.update(labels).set(patch).where(eq(labels.id, id)).run();
    logActivity(db, { boardId: label.boardId, actorId: req.user.id, type: 'label.updated', data: { labelId: id } });
    emit.boardChanged(label.boardId, req.user.id);
    return reply.send(toLabel(db.select().from(labels).where(eq(labels.id, id)).get()!));
  });

  app.delete('/api/labels/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const label = db.select().from(labels).where(eq(labels.id, id)).get();
    if (!label) return reply.code(404).send({ error: 'label not found' });
    if (!canAccessBoard(db, req.user.id, label.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(cardLabels).where(eq(cardLabels.labelId, id)).run();
    db.delete(labels).where(eq(labels.id, id)).run();
    logActivity(db, { boardId: label.boardId, actorId: req.user.id, type: 'label.deleted', data: { labelId: id } });
    emit.boardChanged(label.boardId, req.user.id);
    return reply.code(204).send();
  });

  // BOARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- boards-labels` → expected: 4 passed.

- [ ] **Step 5: Commit.**

```
git add server/src/routes/boards.ts server/test/boards-labels.test.ts && git commit -m "feat: board labels create/rename/delete (delete detaches card_labels)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.8: Archived items list + restore

`GET /api/boards/:id/archived` → `{ lists, cards }` (archived only, ordered by `(position, id)`); `POST /api/boards/:id/restore {entity,id}` un-archives a `list` or `card` belonging to the board and returns the fresh `BoardDetail`. Archived lists/cards are seeded via direct `db` writes (Section 5 owns list/card archival routes).

**Files:** modify `server/src/routes/boards.ts` (add `isNotNull` import + append at sentinel); create `server/test/boards-archived.test.ts`.

- [ ] **Step 1: Write the failing test `server/test/boards-archived.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';
import { cards, lists } from '../src/db/schema';

async function setup() {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'B', visibility: 'team', accentColor: 'coral' } })).json().board.id;
  const now = new Date().toISOString();
  db.insert(lists).values({ id: 'l1', boardId, name: 'Live', position: 'a0', archivedAt: null }).run();
  db.insert(lists).values({ id: 'l2', boardId, name: 'Gone', position: 'a1', archivedAt: now }).run();
  db.insert(cards).values({ id: 'c1', listId: 'l1', boardId, title: 'DeadCard', description: '', dueDate: null, position: 'a0', archivedAt: now, createdBy: admin.id, createdAt: now, updatedAt: now }).run();
  return { app, db, cookie, boardId };
}

describe('archived items + restore', () => {
  it('lists archived lists and cards, excluding them from the live board detail', async () => {
    const { app, cookie, boardId } = await setup();
    const archived = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}/archived`, headers: { cookie } })).json();
    expect(archived.lists.map((l: { id: string }) => l.id)).toEqual(['l2']);
    expect(archived.cards.map((c: { id: string }) => c.id)).toEqual(['c1']);
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.lists.map((l: { id: string }) => l.id)).toEqual(['l1']);
    expect(detail.cards.map((c: { id: string }) => c.id)).toEqual([]);
  });

  it('restores a card and a list back into the live board detail', async () => {
    const { app, cookie, boardId } = await setup();
    const restoreCard = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/restore`, headers: { cookie }, payload: { entity: 'card', id: 'c1' } });
    expect(restoreCard.statusCode).toBe(200);
    expect(restoreCard.json().cards.map((c: { id: string }) => c.id)).toContain('c1');
    const restoreList = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/restore`, headers: { cookie }, payload: { entity: 'list', id: 'l2' } });
    expect(restoreList.json().lists.map((l: { id: string }) => l.id).sort()).toEqual(['l1', 'l2']);
  });

  it('rejects a bad entity (400) and an id from another board (404)', async () => {
    const { app, cookie, boardId } = await setup();
    const badEntity = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/restore`, headers: { cookie }, payload: { entity: 'board', id: 'l2' } });
    expect(badEntity.statusCode).toBe(400);
    const missing = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/restore`, headers: { cookie }, payload: { entity: 'list', id: 'nope' } });
    expect(missing.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- boards-archived` → expected: FAIL — the archived/restore routes return 404 (not registered).

- [ ] **Step 3: Add `isNotNull` to the drizzle import.** In `server/src/routes/boards.ts`, replace:

```ts
import { and, asc, eq, isNull } from 'drizzle-orm';
```

with:

```ts
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
```

- [ ] **Step 4: Append the archived + restore handlers.** Replace the sentinel `  // BOARD_ROUTES_APPEND` in `server/src/routes/boards.ts` with:

```ts
  app.get('/api/boards/:id/archived', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, id)) return reply.code(403).send({ error: 'forbidden' });

    const archivedLists: ListDto[] = db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, id), isNotNull(lists.archivedAt)))
      .orderBy(asc(lists.position), asc(lists.id))
      .all()
      .map((l) => ({ id: l.id, boardId: l.boardId, name: l.name, position: l.position, archivedAt: l.archivedAt }));
    const archivedCards: CardDto[] = db
      .select()
      .from(cards)
      .where(and(eq(cards.boardId, id), isNotNull(cards.archivedAt)))
      .orderBy(asc(cards.position), asc(cards.id))
      .all()
      .map((c) => cardToDto(db, c));
    return reply.send({ lists: archivedLists, cards: archivedCards });
  });

  const restoreSchema = z.object({ entity: z.enum(['list', 'card']), id: z.string().min(1) });

  app.post('/api/boards/:id/restore', { preHandler: requireAuth }, async (req, reply) => {
    const { id: boardId } = req.params as { id: string };
    const parsed = restoreSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const board = db.select().from(boards).where(eq(boards.id, boardId)).get();
    if (!board) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, boardId)) return reply.code(403).send({ error: 'forbidden' });

    if (parsed.data.entity === 'list') {
      const list = db.select().from(lists).where(eq(lists.id, parsed.data.id)).get();
      if (!list || list.boardId !== boardId) return reply.code(404).send({ error: 'list not found' });
      db.update(lists).set({ archivedAt: null }).where(eq(lists.id, list.id)).run();
    } else {
      const card = db.select().from(cards).where(eq(cards.id, parsed.data.id)).get();
      if (!card || card.boardId !== boardId) return reply.code(404).send({ error: 'card not found' });
      db.update(cards).set({ archivedAt: null }).where(eq(cards.id, card.id)).run();
    }
    logActivity(db, { boardId, actorId: req.user.id, type: 'board.restored', data: { entity: parsed.data.entity, id: parsed.data.id } });
    emit.boardChanged(boardId, req.user.id);
    return reply.send(buildBoardDetail(db, board, req.user.id));
  });

  // BOARD_ROUTES_APPEND
```

- [ ] **Step 5: Run and confirm pass.** `npm test -w server -- boards-archived` → expected: 3 passed.

- [ ] **Step 6: Commit.**

```
git add server/src/routes/boards.ts server/test/boards-archived.test.ts && git commit -m "feat: archived items list + restore (list/card)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4.9: Permission matrix, deactivated guard, and `emit.boardChanged` spy

All routes are already implemented (Tasks 4.2–4.8). This task drives their permission behavior and the realtime emit with failing-first tests, then verifies the whole server suite and the TypeScript build.

**Files:** create `server/test/boards-perms.test.ts`.

- [ ] **Step 1: Write the test `server/test/boards-perms.test.ts`.**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createDb } from '../src/db/index';
import { buildApp } from '../src/app';
import { makeApp, seedUser, login } from './helpers';

async function base() {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const bob = seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'pw123456', isAdmin: false });
  const adminCookie = await login(app, 'a@x.com', 'pw123456');
  const bobCookie = await login(app, 'b@x.com', 'pw123456');
  return { app, db, admin, bob, adminCookie, bobCookie };
}

describe('board permissions', () => {
  it('team board: a non-member can read the detail', async () => {
    const { app, adminCookie, bobCookie } = await base();
    const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie: adminCookie }, payload: { name: 'T', visibility: 'team', accentColor: 'coral' } })).json().board.id;
    expect((await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie } })).statusCode).toBe(200);
  });

  it('private board: a non-member is blocked (403) from read and every mutation', async () => {
    const { app, adminCookie, bobCookie } = await base();
    const board = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie: adminCookie }, payload: { name: 'P', visibility: 'private', accentColor: 'coral' } })).json();
    const boardId = board.board.id;
    const labelId = board.labels[0].id;
    expect((await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie }, payload: { name: 'X' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie: bobCookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `/api/boards/${boardId}/star`, headers: { cookie: bobCookie }, payload: { starred: true } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `/api/boards/${boardId}/labels`, headers: { cookie: bobCookie }, payload: { color: 'blue' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/labels/${labelId}`, headers: { cookie: bobCookie }, payload: { name: 'X' } })).statusCode).toBe(403);
  });

  it('a deactivated user\'s session is rejected (401) on board routes', async () => {
    const { app, db, bob, bobCookie } = await base();
    const { users } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    db.update(users).set({ deactivatedAt: new Date().toISOString() }).where(eq(users.id, bob.id)).run();
    expect((await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: bobCookie } })).statusCode).toBe(401);
  });
});

describe('emit.boardChanged', () => {
  it('fires once per mutation (create, patch, star, member add, label create, archive)', async () => {
    const { db } = createDb(':memory:');
    const boardChanged = vi.fn();
    const app = buildApp({ db, dataDir: '/tmp/company-trello-test', emit: { boardChanged } });
    const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
    const bob = seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'pw123456', isAdmin: false });
    const cookie = await login(app, 'a@x.com', 'pw123456');

    const boardId = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'B', visibility: 'team', accentColor: 'coral' } })).json().board.id;
    expect(boardChanged).toHaveBeenCalledWith(boardId, admin.id);

    boardChanged.mockClear();
    await app.inject({ method: 'PATCH', url: `/api/boards/${boardId}`, headers: { cookie }, payload: { name: 'B2' } });
    await app.inject({ method: 'POST', url: `/api/boards/${boardId}/star`, headers: { cookie }, payload: { starred: true } });
    await app.inject({ method: 'POST', url: `/api/boards/${boardId}/members`, headers: { cookie }, payload: { userId: bob.id } });
    await app.inject({ method: 'POST', url: `/api/boards/${boardId}/labels`, headers: { cookie }, payload: { color: 'blue' } });
    await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie } });
    expect(boardChanged).toHaveBeenCalledTimes(5);
    expect(boardChanged).toHaveBeenLastCalledWith(boardId, admin.id);
  });
});
```

- [ ] **Step 2: Run and confirm pass.** `npm test -w server -- boards-perms` → expected: 4 passed. (Behavior is already implemented; if any assertion fails, fix the corresponding handler in `server/src/routes/boards.ts` before continuing.)

- [ ] **Step 3: Run the full server suite for regressions.** `npm test -w server` → expected: all green. Section 4 contributes 9 files / 33 tests (activity 2, boards-create 5, boards-list 4, boards-patch 5, boards-star 3, boards-members 3, boards-labels 4, boards-archived 3, boards-perms 4); Section 1–3 suites remain green.

- [ ] **Step 4: Type-check the server workspace.** `npm run build -w server` → expected: `tsc` exits 0 — confirms the `RouteCtx` export, no unused imports (`isNotNull` is now used), no `any`, and that `boards.ts`'s Drizzle/`@shared/types` usage type-checks.

- [ ] **Step 5: Commit.**

```
git add server/test/boards-perms.test.ts && git commit -m "test: board permission matrix + emit.boardChanged spy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Section 4 done — definition of done

- `server/src/lib/activity.ts` (`logActivity`) and `server/src/routes/boards.ts` (`registerBoardRoutes`) exist; `server/src/app.ts` exports `RouteCtx` and calls `registerBoardRoutes(app, ctx)` after the auth block (Section 5 appends `registerListRoutes`/`registerCardRoutes` after this line).
- 9 test files, 33 tests, all passing; `npm run build -w server` exits 0.
- `POST /api/boards` seeds 8 blank labels (one per `LabelColor`), makes the creator a `board_member`, and returns `BoardDetail`; `GET /api/boards/:id` returns `BoardDetail` with non-archived lists/cards ordered `(position, id)` (Section 5 relies on both).
- Every mutation writes an `activity` row and calls `emit.boardChanged(boardId, req.user.id)`.
- Permissions enforced server-side: team boards readable by any active user, private boards 403 for non-members, deactivated sessions 401; access failures are 403, missing/archived boards are 404.
- `DELETE` archives; `GET /api/boards/:id/archived` + `POST /api/boards/:id/restore {entity,id}` recover archived lists/cards; deleting a label removes its `card_labels` rows.


---

## Section 5: Lists & cards API: CRUD, moves, assignees, card labels, checklist

### Files

- **Create:** `server/src/lib/email.ts`, `server/src/lib/notify.ts`, `server/src/routes/lists.ts`, `server/src/routes/cards.ts`
- **Modify:** `server/src/app.ts` (register the two new route modules inside `buildApp`)
- **Test:** `server/test/lists.test.ts`, `server/test/cards.test.ts`, `server/test/cards-move.test.ts`, `server/test/assignees.test.ts`, `server/test/labels.test.ts`, `server/test/checklist.test.ts`

### Preconditions (artifacts from sections 1–4 — use verbatim, do NOT redefine)

- `shared/types.ts` complete (import DTOs from `@shared/types`): `CardDto`, `ListDto`, `ChecklistItemDto`, `CommentDto`, `AttachmentDto`, `ActivityDto`, `NotificationType`.
- `server/src/db/schema.ts` exports Drizzle tables (camelCase names): `boards`, `lists`, `cards`, `cardAssignees`, `labels`, `cardLabels`, `checklistItems`, `comments`, `attachments`, `activity`, `notifications`. Each table supports `.$inferSelect` / `.$inferInsert`. Columns are camelCase (`cards.listId`, `cards.boardId`, `cards.dueDate`, `cards.archivedAt`, `cards.createdBy`, `cards.createdAt`, `cards.updatedAt`, `cards.position`, `checklistItems.done`, etc.).
- `server/src/lib/position.ts` → `positionBetween(a: string | null, b: string | null): string` (fractional index + jitter suffix).
- `server/src/lib/activity.ts` → `logActivity(db, { boardId, cardId?, actorId, type, data })` (serializes `data` to JSON text into `activity`).
- `server/src/lib/perms.ts` → `requireAuth` (Fastify preHandler that 401s and sets `req.user: Me`), `canAccessBoard(db, userId, boardId): boolean` (**synchronous**; admins pass for any board, team boards pass for any active user, private boards require a `board_members` row). `req.user` is typed via a Fastify module augmentation added in section 3.
- `server/src/app.ts` → `buildApp({ db, dataDir, emit })` builds a `ctx: RouteCtx` and registers each route module by calling `registerXRoutes(app, ctx)` (section 4 already does `registerBoardRoutes(app, ctx);`). `RouteCtx` is exported from `./app` with shape `{ db: Db; dataDir: string; emit: { boardChanged(boardId: string, byUserId: string): void } }`. *(If section 4 placed `RouteCtx` in another module, import it from that path instead.)*
- `server/test/helpers.ts` → `makeApp(): { app, db }` (builds the app with a **no-op** `emit`), `seedUser(db, { email, name, password, isAdmin }): user` (returns a row with `.id`), `login(app, email, password): Promise<string>` (returns the `cookie` header value).
- `GET /api/boards/:id` (section 4) returns `BoardDetail` whose `lists`/`cards` exclude archived rows and are ordered `ORDER BY (position, id)`. Tests use it to assert ordering and archive exclusion.

### Activity `type` strings introduced by this section (plain strings; `activity.type` is `text`)

`list.created`, `list.renamed`, `list.moved`, `list.archived`, `card.created`, `card.renamed`, `card.description_updated`, `card.due_date_set`, `card.due_date_cleared`, `card.moved`, `card.archived`, `card.assignee_added`, `card.assignee_removed`, `card.label_added`, `card.label_removed`, `card.checklist_item_added`, `card.checklist_item_toggled`, `card.checklist_item_edited`, `card.checklist_item_deleted`.

Note on move semantics: server-computed "create at end" positions come from `positionBetween(last, null)` (jitter guarantees distinct keys — unit-tested in section 2). Client-driven **moves** write the client-supplied `position` string **verbatim** (no recompute, no added jitter). Equal positions are harmless because every read orders by `(position, id)`; Task 5.3 tests both the verbatim write and the deterministic tie-break.

---

### Task 5.0: Notification helpers (`lib/email.ts` + `lib/notify.ts`) — created here because Task 5.4 imports them

Task 5.4 adds `import { notify } from '../lib/notify';` to `server/src/routes/cards.ts`, and `notify.ts` imports `sendEmail` from `server/src/lib/email.ts`. Because `cards.ts` is registered by `buildApp`, the import must resolve or every Section 5 card-route test fails. Both files depend only on Sections 1–2 (`@shared/types`, `server/src/db/schema.ts`, `server/src/db/index.ts`), so they are created here, up front, before any route imports them. Their dedicated unit tests (`email.test.ts`, `notify.test.ts`) are written later in Section 6 (Tasks 6.1–6.2); `notify`'s row-insertion behavior is additionally exercised by this section's own Task 5.4 (`assignees.test.ts`).

**Files:** create `server/src/lib/email.ts`, `server/src/lib/notify.ts`.

- [ ] **Step 1: Create `server/src/lib/email.ts` with full contents.**

```ts
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(`[email] skipped (RESEND_API_KEY/EMAIL_FROM unset): to=${to} subject=${subject}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[email] send failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('[email] send error', err);
  }
}
```

- [ ] **Step 2: Create `server/src/lib/notify.ts` with full contents.**

```ts
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
```

- [ ] **Step 3: Typecheck.** `npm run build -w server` → expected: exit 0 (both files compile; `notify` resolves `sendEmail`, `Db`, the schema tables, and `@shared/types`).

- [ ] **Step 4: Commit.**

```
git add server/src/lib/email.ts server/src/lib/notify.ts && git commit -m "feat: email sender + notify helper (needed by card assignees)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.1: Lists CRUD (create at end, rename, move, archive)

**Files:** create `server/src/routes/lists.ts`; modify `server/src/app.ts`; create `server/test/lists.test.ts`.

- [ ] **Step 1: Write the failing test file `server/test/lists.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (
    await app.inject({
      method: 'POST',
      url: '/api/boards',
      headers: { cookie },
      payload: { name: 'Board', visibility: 'team', accentColor: 'coral' },
    })
  ).json();
  return { app, db, cookie, boardId: board.board.id };
}

describe('lists', () => {
  it('creates lists at the end in order', async () => {
    const { app, cookie, boardId } = await setup();
    const a = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'To Do' } });
    expect(a.statusCode).toBe(201);
    expect(a.json().name).toBe('To Do');
    const b = await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'Doing' } });
    expect(b.statusCode).toBe(201);
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.lists.map((l: { name: string }) => l.name)).toEqual(['To Do', 'Doing']);
  });

  it('renames a list', async () => {
    const { app, cookie, boardId } = await setup();
    const a = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'To Do' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/lists/${a.id}`, headers: { cookie }, payload: { name: 'Done' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Done');
  });

  it('moves a list, writing the position verbatim', async () => {
    const { app, cookie, boardId } = await setup();
    const a = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'To Do' } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/lists/${a.id}`, headers: { cookie }, payload: { position: 'a1' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().position).toBe('a1');
  });

  it('archives a list so it drops out of the board detail', async () => {
    const { app, cookie, boardId } = await setup();
    const a = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'To Do' } })).json();
    const res = await app.inject({ method: 'DELETE', url: `/api/lists/${a.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(204);
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.lists).toHaveLength(0);
  });

  it('404s creating a list on a missing board', async () => {
    const { app, cookie } = await setup();
    const res = await app.inject({ method: 'POST', url: '/api/boards/missing/lists', headers: { cookie }, payload: { name: 'X' } });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.** `npm test -w server -- lists` → expected: FAIL (5 failed — POST/PATCH/DELETE routes return 404 because `lists.ts` is not registered yet).

- [ ] **Step 3: Create `server/src/routes/lists.ts` with full contents.**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { ListDto } from '@shared/types';
import type { RouteCtx } from '../app';
import { boards, lists } from '../db/schema';
import { requireAuth, canAccessBoard } from '../lib/perms';
import { positionBetween } from '../lib/position';
import { logActivity } from '../lib/activity';

const createListSchema = z.object({ name: z.string().trim().min(1).max(200) });
const patchListSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    position: z.string().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

function toListDto(row: typeof lists.$inferSelect): ListDto {
  return { id: row.id, boardId: row.boardId, name: row.name, position: row.position, archivedAt: row.archivedAt };
}

export function registerListRoutes(app: FastifyInstance, ctx: RouteCtx) {
  const { db, emit } = ctx;

  app.post('/api/boards/:id/lists', { preHandler: requireAuth }, async (req, reply) => {
    const { id: boardId } = req.params as { id: string };
    const parsed = createListSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const board = db.select().from(boards).where(eq(boards.id, boardId)).get();
    if (!board || board.archivedAt) return reply.code(404).send({ error: 'board not found' });
    if (!canAccessBoard(db, req.user.id, boardId)) return reply.code(403).send({ error: 'forbidden' });

    const last = db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
      .orderBy(desc(lists.position), desc(lists.id))
      .limit(1)
      .get();
    const row = {
      id: nanoid(12),
      boardId,
      name: parsed.data.name,
      position: positionBetween(last?.position ?? null, null),
      archivedAt: null as string | null,
    };
    db.insert(lists).values(row).run();
    logActivity(db, { boardId, actorId: req.user.id, type: 'list.created', data: { listId: row.id, name: row.name } });
    emit.boardChanged(boardId, req.user.id);
    return reply.code(201).send(toListDto(row));
  });

  app.patch('/api/lists/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchListSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const list = db.select().from(lists).where(eq(lists.id, id)).get();
    if (!list) return reply.code(404).send({ error: 'list not found' });
    if (!canAccessBoard(db, req.user.id, list.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof lists.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.position !== undefined) patch.position = parsed.data.position;
    db.update(lists).set(patch).where(eq(lists.id, id)).run();

    const type = parsed.data.name !== undefined ? 'list.renamed' : 'list.moved';
    logActivity(db, { boardId: list.boardId, actorId: req.user.id, type, data: { listId: id } });
    emit.boardChanged(list.boardId, req.user.id);
    const updated = db.select().from(lists).where(eq(lists.id, id)).get()!;
    return reply.send(toListDto(updated));
  });

  app.delete('/api/lists/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const list = db.select().from(lists).where(eq(lists.id, id)).get();
    if (!list) return reply.code(404).send({ error: 'list not found' });
    if (!canAccessBoard(db, req.user.id, list.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.update(lists).set({ archivedAt: new Date().toISOString() }).where(eq(lists.id, id)).run();
    logActivity(db, { boardId: list.boardId, actorId: req.user.id, type: 'list.archived', data: { listId: id, name: list.name } });
    emit.boardChanged(list.boardId, req.user.id);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 4: Wire the module into `server/src/app.ts`.** Add the import alongside the other route imports at the top of the file:

```ts
import { registerListRoutes } from './routes/lists';
```

Then, inside `buildApp`, immediately after the existing `registerBoardRoutes(app, ctx);` line (the pattern section 4 established), add:

```ts
registerListRoutes(app, ctx);
```

- [ ] **Step 5: Run the test and confirm it passes.** `npm test -w server -- lists` → expected: 5 passed.

- [ ] **Step 6: Commit.**

```
git add -A && git commit -m "feat: lists CRUD (create at end, rename, move, archive)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.2: Card create + GET card detail (with `loadCardDto` helper)

**Files:** create `server/src/routes/cards.ts`; modify `server/src/app.ts`; create `server/test/cards.test.ts`.

- [ ] **Step 1: Write the failing test file `server/test/cards.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (
    await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Board', visibility: 'team', accentColor: 'coral' } })
  ).json();
  const listId = (
    await app.inject({ method: 'POST', url: `/api/boards/${board.board.id}/lists`, headers: { cookie }, payload: { name: 'To Do' } })
  ).json().id;
  return { app, db, cookie, boardId: board.board.id, listId };
}

describe('card create + detail', () => {
  it('creates a card at the end of the list', async () => {
    const { app, cookie, listId, boardId } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'Task 1' } });
    expect(res.statusCode).toBe(201);
    const card = res.json();
    expect(card.title).toBe('Task 1');
    expect(card.listId).toBe(listId);
    expect(card.boardId).toBe(boardId);
    expect(card.description).toBe('');
    expect(card.dueDate).toBeNull();
    expect(card.assigneeIds).toEqual([]);
    expect(card.labelIds).toEqual([]);
    expect(card.checklist).toEqual([]);
    expect(card.attachmentCount).toBe(0);
    expect(card.commentCount).toBe(0);
  });

  it('orders two cards by (position, id)', async () => {
    const { app, cookie, listId, boardId } = await setup();
    await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'One' } });
    await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'Two' } });
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.cards.map((c: { title: string }) => c.title)).toEqual(['One', 'Two']);
  });

  it('returns card detail with created activity and empty comments/attachments', async () => {
    const { app, cookie, listId } = await setup();
    const card = (await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'Task 1' } })).json();
    const res = await app.inject({ method: 'GET', url: `/api/cards/${card.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const detail = res.json();
    expect(detail.comments).toEqual([]);
    expect(detail.attachments).toEqual([]);
    expect(detail.activity).toHaveLength(1);
    expect(detail.activity[0].type).toBe('card.created');
  });

  it('404s GET on an unknown card', async () => {
    const { app, cookie } = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/cards/missing', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.** `npm test -w server -- cards.test` → expected: FAIL (4 failed — routes not registered).

- [ ] **Step 3: Create `server/src/routes/cards.ts` with full contents.** (Later tasks append routes at the `// CARD_ROUTES_APPEND` sentinel — keep it exactly as written.)

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { ActivityDto, AttachmentDto, CardDto, ChecklistItemDto, CommentDto } from '@shared/types';
import type { RouteCtx } from '../app';
import { activity, attachments, cardAssignees, cardLabels, cards, checklistItems, comments, lists } from '../db/schema';
import { requireAuth, canAccessBoard } from '../lib/perms';
import { positionBetween } from '../lib/position';
import { logActivity } from '../lib/activity';

type Db = RouteCtx['db'];

const createCardSchema = z.object({ title: z.string().trim().min(1).max(500) });

function loadCardDto(db: Db, cardId: string): CardDto | undefined {
  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card) return undefined;
  const assigneeIds = db.select().from(cardAssignees).where(eq(cardAssignees.cardId, cardId)).all().map((r) => r.userId);
  const labelIds = db.select().from(cardLabels).where(eq(cardLabels.cardId, cardId)).all().map((r) => r.labelId);
  const checklist: ChecklistItemDto[] = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, cardId))
    .orderBy(asc(checklistItems.position), asc(checklistItems.id))
    .all()
    .map((r) => ({ id: r.id, cardId: r.cardId, text: r.text, done: r.done, position: r.position }));
  const attachmentCount = db.select().from(attachments).where(eq(attachments.cardId, cardId)).all().length;
  const commentCount = db.select().from(comments).where(eq(comments.cardId, cardId)).all().length;
  return {
    id: card.id,
    listId: card.listId,
    boardId: card.boardId,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate,
    position: card.position,
    archivedAt: card.archivedAt,
    createdBy: card.createdBy,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    assigneeIds,
    labelIds,
    checklist,
    attachmentCount,
    commentCount,
  };
}

export function registerCardRoutes(app: FastifyInstance, ctx: RouteCtx) {
  const { db, emit } = ctx;

  app.post('/api/lists/:id/cards', { preHandler: requireAuth }, async (req, reply) => {
    const { id: listId } = req.params as { id: string };
    const parsed = createCardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const list = db.select().from(lists).where(eq(lists.id, listId)).get();
    if (!list || list.archivedAt) return reply.code(404).send({ error: 'list not found' });
    if (!canAccessBoard(db, req.user.id, list.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const last = db
      .select()
      .from(cards)
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
      .orderBy(desc(cards.position), desc(cards.id))
      .limit(1)
      .get();
    const now = new Date().toISOString();
    const id = nanoid(12);
    db.insert(cards)
      .values({
        id,
        listId,
        boardId: list.boardId,
        title: parsed.data.title,
        description: '',
        dueDate: null,
        position: positionBetween(last?.position ?? null, null),
        archivedAt: null,
        createdBy: req.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    logActivity(db, { boardId: list.boardId, cardId: id, actorId: req.user.id, type: 'card.created', data: { title: parsed.data.title } });
    emit.boardChanged(list.boardId, req.user.id);
    return reply.code(201).send(loadCardDto(db, id)!);
  });

  app.get('/api/cards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const dto = loadCardDto(db, id)!;
    const cardComments: CommentDto[] = db
      .select()
      .from(comments)
      .where(eq(comments.cardId, id))
      .orderBy(asc(comments.createdAt), asc(comments.id))
      .all()
      .map((r) => ({ id: r.id, cardId: r.cardId, authorId: r.authorId, body: r.body, createdAt: r.createdAt }));
    const cardAttachments: AttachmentDto[] = db
      .select()
      .from(attachments)
      .where(eq(attachments.cardId, id))
      .orderBy(asc(attachments.createdAt), asc(attachments.id))
      .all()
      .map((r) => ({ id: r.id, cardId: r.cardId, filename: r.filename, sizeBytes: r.sizeBytes, mime: r.mime, uploadedBy: r.uploadedBy, createdAt: r.createdAt }));
    const cardActivity: ActivityDto[] = db
      .select()
      .from(activity)
      .where(eq(activity.cardId, id))
      .orderBy(desc(activity.createdAt), desc(activity.id))
      .all()
      .map((r) => ({ id: r.id, boardId: r.boardId, cardId: r.cardId, actorId: r.actorId, type: r.type, data: JSON.parse(r.data) as Record<string, unknown>, createdAt: r.createdAt }));

    return reply.send({ ...dto, comments: cardComments, attachments: cardAttachments, activity: cardActivity });
  });

  // CARD_ROUTES_APPEND
}
```

- [ ] **Step 4: Wire the module into `server/src/app.ts`.** Add the import at the top:

```ts
import { registerCardRoutes } from './routes/cards';
```

Then inside `buildApp`, immediately after `registerListRoutes(app, ctx);`, add:

```ts
registerCardRoutes(app, ctx);
```

- [ ] **Step 5: Run the test and confirm it passes.** `npm test -w server -- cards.test` → expected: 4 passed.

- [ ] **Step 6: Commit.**

```
git add -A && git commit -m "feat: card create at end + GET card detail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.3: Card PATCH (title / description / dueDate / move) + archive

Covers the TDD focus: move position written verbatim, cross-board `listId` rejected, archived card excluded from `BoardDetail`, date-only `dueDate` validation, deterministic tie-break.

**Files:** modify `server/src/routes/cards.ts` (append at sentinel); create `server/test/cards-move.test.ts`.

- [ ] **Step 1: Write the failing test file `server/test/cards-move.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (
    await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Board', visibility: 'team', accentColor: 'coral' } })
  ).json();
  const boardId = board.board.id;
  const list1 = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'L1' } })).json().id;
  const list2 = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'L2' } })).json().id;
  return { app, db, cookie, boardId, list1, list2 };
}

function createCard(app: Awaited<ReturnType<typeof setup>>['app'], cookie: string, listId: string, title: string) {
  return app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title } });
}

describe('card patch + move', () => {
  it('renames a card and logs the change', async () => {
    const { app, cookie, list1 } = await setup();
    const card = (await createCard(app, cookie, list1, 'Old')).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { title: 'New' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('New');
    const detail = (await app.inject({ method: 'GET', url: `/api/cards/${card.id}`, headers: { cookie } })).json();
    expect(detail.activity.some((a: { type: string }) => a.type === 'card.renamed')).toBe(true);
  });

  it('validates due dates (date-only), sets, and clears them', async () => {
    const { app, cookie, list1 } = await setup();
    const card = (await createCard(app, cookie, list1, 'C')).json();
    const bad = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { dueDate: '2026-02-30' } });
    expect(bad.statusCode).toBe(400);
    const badShape = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { dueDate: '2026-7-1' } });
    expect(badShape.statusCode).toBe(400);
    const ok = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { dueDate: '2026-07-20' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().dueDate).toBe('2026-07-20');
    const cleared = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { dueDate: null } });
    expect(cleared.json().dueDate).toBeNull();
  });

  it('moves a card to another list, writing the position verbatim', async () => {
    const { app, cookie, list1, list2 } = await setup();
    const card = (await createCard(app, cookie, list1, 'C')).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { listId: list2, position: 'm5' } });
    expect(res.statusCode).toBe(200);
    const moved = res.json();
    expect(moved.listId).toBe(list2);
    expect(moved.position).toBe('m5');
    const detail = (await app.inject({ method: 'GET', url: `/api/cards/${card.id}`, headers: { cookie } })).json();
    expect(detail.activity.some((a: { type: string }) => a.type === 'card.moved')).toBe(true);
  });

  it('rejects a listId that belongs to another board', async () => {
    const { app, cookie, list1 } = await setup();
    const other = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Other', visibility: 'team', accentColor: 'blue' } })).json();
    const otherList = (await app.inject({ method: 'POST', url: `/api/boards/${other.board.id}/lists`, headers: { cookie }, payload: { name: 'L' } })).json().id;
    const card = (await createCard(app, cookie, list1, 'C')).json();
    const res = await app.inject({ method: 'PATCH', url: `/api/cards/${card.id}`, headers: { cookie }, payload: { listId: otherList, position: 'n' } });
    expect(res.statusCode).toBe(400);
  });

  it('excludes an archived card from board detail but still serves it directly', async () => {
    const { app, cookie, list1, boardId } = await setup();
    const card = (await createCard(app, cookie, list1, 'C')).json();
    const del = await app.inject({ method: 'DELETE', url: `/api/cards/${card.id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    expect(detail.cards.find((c: { id: string }) => c.id === card.id)).toBeUndefined();
    const direct = await app.inject({ method: 'GET', url: `/api/cards/${card.id}`, headers: { cookie } });
    expect(direct.statusCode).toBe(200);
    expect(direct.json().archivedAt).not.toBeNull();
  });

  it('breaks position ties deterministically by id', async () => {
    const { app, cookie, list1, boardId } = await setup();
    const c1 = (await createCard(app, cookie, list1, 'C1')).json();
    const c2 = (await createCard(app, cookie, list1, 'C2')).json();
    await app.inject({ method: 'PATCH', url: `/api/cards/${c1.id}`, headers: { cookie }, payload: { position: 'm' } });
    await app.inject({ method: 'PATCH', url: `/api/cards/${c2.id}`, headers: { cookie }, payload: { position: 'm' } });
    const detail = (await app.inject({ method: 'GET', url: `/api/boards/${boardId}`, headers: { cookie } })).json();
    const order = detail.cards
      .filter((c: { id: string }) => c.id === c1.id || c.id === c2.id)
      .map((c: { id: string }) => c.id);
    expect(order).toEqual([c1.id, c2.id].sort());
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- cards-move` → expected: FAIL (6 failed — PATCH/DELETE card routes not implemented; PATCH returns 404).

- [ ] **Step 3: Append the PATCH + DELETE handlers in `server/src/routes/cards.ts`.** Replace the sentinel line `  // CARD_ROUTES_APPEND` with the block below (which re-emits the sentinel at the end so later tasks can append):

```ts
  const dueDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
    .refine((s) => {
      const d = new Date(`${s}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, 'invalid calendar date');
  const patchCardSchema = z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      description: z.string().max(20000).optional(),
      dueDate: z.union([dueDateSchema, z.null()]).optional(),
      listId: z.string().min(1).optional(),
      position: z.string().min(1).optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.patch('/api/cards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchCardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const { title, description, dueDate, listId, position } = parsed.data;

    if (listId !== undefined) {
      const target = db.select().from(lists).where(eq(lists.id, listId)).get();
      if (!target || target.archivedAt) return reply.code(404).send({ error: 'target list not found' });
      if (target.boardId !== card.boardId) return reply.code(400).send({ error: 'list belongs to another board' });
    }

    const patch: Partial<typeof cards.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (dueDate !== undefined) patch.dueDate = dueDate;
    if (listId !== undefined) patch.listId = listId;
    if (position !== undefined) patch.position = position;
    db.update(cards).set(patch).where(eq(cards.id, id)).run();

    if (title !== undefined && title !== card.title)
      logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.renamed', data: { title } });
    if (description !== undefined && description !== card.description)
      logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.description_updated', data: {} });
    if (dueDate !== undefined && dueDate !== card.dueDate)
      logActivity(db, {
        boardId: card.boardId,
        cardId: id,
        actorId: req.user.id,
        type: dueDate === null ? 'card.due_date_cleared' : 'card.due_date_set',
        data: dueDate === null ? {} : { dueDate },
      });
    if (position !== undefined || (listId !== undefined && listId !== card.listId))
      logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.moved', data: { fromListId: card.listId, toListId: listId ?? card.listId } });

    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  app.delete('/api/cards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const now = new Date().toISOString();
    db.update(cards).set({ archivedAt: now, updatedAt: now }).where(eq(cards.id, id)).run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.archived', data: { title: card.title } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.code(204).send();
  });

  // CARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- cards-move` → expected: 6 passed.

- [ ] **Step 5: Re-run the earlier card/list suites to catch regressions.** `npm test -w server -- cards.test lists` → expected: 9 passed (4 + 5).

- [ ] **Step 6: Commit.**

```
git add -A && git commit -m "feat: card PATCH (title/description/dueDate/move) + archive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.4: Assignees (add + remove; add notifies `assigned`)

**Files:** modify `server/src/routes/cards.ts` (add `notify` import + append at sentinel); create `server/test/assignees.test.ts`.

- [ ] **Step 1: Write the failing test file `server/test/assignees.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { makeApp, seedUser, login } from './helpers';
import { notifications } from '../src/db/schema';

async function setup(visibility: 'team' | 'private' = 'team') {
  const { app, db } = makeApp();
  const admin = seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const bob = seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'pw123456', isAdmin: false });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (
    await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Board', visibility, accentColor: 'coral' } })
  ).json();
  const boardId = board.board.id;
  const listId = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'L' } })).json().id;
  const cardId = (await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'C' } })).json().id;
  return { app, db, admin, bob, cookie, boardId, cardId };
}

describe('assignees', () => {
  it('adds an assignee, records activity, and notifies them', async () => {
    const { app, db, bob, cookie, cardId } = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/cards/${cardId}/assignees`, headers: { cookie }, payload: { userId: bob.id } });
    expect(res.statusCode).toBe(200);
    expect(res.json().assigneeIds).toContain(bob.id);
    const notes = db.select().from(notifications).where(and(eq(notifications.userId, bob.id), eq(notifications.type, 'assigned'))).all();
    expect(notes).toHaveLength(1);
    expect(notes[0].cardId).toBe(cardId);
    const detail = (await app.inject({ method: 'GET', url: `/api/cards/${cardId}`, headers: { cookie } })).json();
    expect(detail.activity.some((a: { type: string }) => a.type === 'card.assignee_added')).toBe(true);
  });

  it('does not notify on self-assignment', async () => {
    const { app, db, admin, cookie, cardId } = await setup();
    await app.inject({ method: 'POST', url: `/api/cards/${cardId}/assignees`, headers: { cookie }, payload: { userId: admin.id } });
    const notes = db.select().from(notifications).where(eq(notifications.userId, admin.id)).all();
    expect(notes).toHaveLength(0);
  });

  it('removes an assignee', async () => {
    const { app, bob, cookie, cardId } = await setup();
    await app.inject({ method: 'POST', url: `/api/cards/${cardId}/assignees`, headers: { cookie }, payload: { userId: bob.id } });
    const res = await app.inject({ method: 'DELETE', url: `/api/cards/${cardId}/assignees/${bob.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().assigneeIds).not.toContain(bob.id);
  });

  it('rejects assigning a user without board access', async () => {
    const { app, bob, cookie, cardId } = await setup('private');
    const res = await app.inject({ method: 'POST', url: `/api/cards/${cardId}/assignees`, headers: { cookie }, payload: { userId: bob.id } });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- assignees` → expected: FAIL (4 failed — routes not implemented).

- [ ] **Step 3: Add the `notify` import to `server/src/routes/cards.ts`.** Replace the line `import { logActivity } from '../lib/activity';` with:

```ts
import { logActivity } from '../lib/activity';
import { notify } from '../lib/notify';
```

- [ ] **Step 4: Append the assignee handlers.** Replace the sentinel `  // CARD_ROUTES_APPEND` with:

```ts
  const assigneeBodySchema = z.object({ userId: z.string().min(1) });

  app.post('/api/cards/:id/assignees', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = assigneeBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });
    const { userId } = parsed.data;
    if (!canAccessBoard(db, userId, card.boardId)) return reply.code(400).send({ error: 'user has no access to this board' });

    db.insert(cardAssignees).values({ cardId: id, userId }).onConflictDoNothing().run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.assignee_added', data: { userId } });
    if (userId !== req.user.id) notify(db, { userId, type: 'assigned', cardId: id, actorId: req.user.id });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  app.delete('/api/cards/:id/assignees/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(cardAssignees).where(and(eq(cardAssignees.cardId, id), eq(cardAssignees.userId, userId))).run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.assignee_removed', data: { userId } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  // CARD_ROUTES_APPEND
```

- [ ] **Step 5: Run and confirm pass.** `npm test -w server -- assignees` → expected: 4 passed.

- [ ] **Step 6: Commit.**

```
git add -A && git commit -m "feat: card assignees add/remove with assigned notification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.5: Card labels (attach / detach)

**Files:** modify `server/src/routes/cards.ts` (add `labels` to schema import + append at sentinel); create `server/test/labels.test.ts`.

- [ ] **Step 1: Write the failing test file `server/test/labels.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (
    await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Board', visibility: 'team', accentColor: 'coral' } })
  ).json();
  const boardId = board.board.id;
  const labelId = board.labels[0].id;
  const listId = (await app.inject({ method: 'POST', url: `/api/boards/${boardId}/lists`, headers: { cookie }, payload: { name: 'L' } })).json().id;
  const cardId = (await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'C' } })).json().id;
  return { app, db, cookie, boardId, labelId, cardId };
}

describe('card labels', () => {
  it('attaches and detaches a board label', async () => {
    const { app, cookie, cardId, labelId } = await setup();
    const attach = await app.inject({ method: 'POST', url: `/api/cards/${cardId}/labels`, headers: { cookie }, payload: { labelId } });
    expect(attach.statusCode).toBe(200);
    expect(attach.json().labelIds).toContain(labelId);
    const detail = (await app.inject({ method: 'GET', url: `/api/cards/${cardId}`, headers: { cookie } })).json();
    expect(detail.activity.some((a: { type: string }) => a.type === 'card.label_added')).toBe(true);
    const detach = await app.inject({ method: 'DELETE', url: `/api/cards/${cardId}/labels/${labelId}`, headers: { cookie } });
    expect(detach.statusCode).toBe(200);
    expect(detach.json().labelIds).not.toContain(labelId);
  });

  it('rejects a label from another board', async () => {
    const { app, cookie, cardId } = await setup();
    const other = (await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Other', visibility: 'team', accentColor: 'blue' } })).json();
    const foreignLabel = other.labels[0].id;
    const res = await app.inject({ method: 'POST', url: `/api/cards/${cardId}/labels`, headers: { cookie }, payload: { labelId: foreignLabel } });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- labels` → expected: FAIL (2 failed — routes not implemented).

- [ ] **Step 3: Add `labels` to the schema import in `server/src/routes/cards.ts`.** In the `from '../db/schema'` import, replace:

```ts
import { activity, attachments, cardAssignees, cardLabels, cards, checklistItems, comments, lists } from '../db/schema';
```

with:

```ts
import { activity, attachments, cardAssignees, cardLabels, cards, checklistItems, comments, labels, lists } from '../db/schema';
```

- [ ] **Step 4: Append the label handlers.** Replace the sentinel `  // CARD_ROUTES_APPEND` with:

```ts
  const labelBodySchema = z.object({ labelId: z.string().min(1) });

  app.post('/api/cards/:id/labels', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = labelBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });
    const label = db.select().from(labels).where(eq(labels.id, parsed.data.labelId)).get();
    if (!label || label.boardId !== card.boardId) return reply.code(400).send({ error: 'label belongs to another board' });

    db.insert(cardLabels).values({ cardId: id, labelId: label.id }).onConflictDoNothing().run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.label_added', data: { labelId: label.id } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  app.delete('/api/cards/:id/labels/:labelId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, labelId } = req.params as { id: string; labelId: string };
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(cardLabels).where(and(eq(cardLabels.cardId, id), eq(cardLabels.labelId, labelId))).run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.label_removed', data: { labelId } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, id)!);
  });

  // CARD_ROUTES_APPEND
```

- [ ] **Step 5: Run and confirm pass.** `npm test -w server -- labels` → expected: 2 passed.

- [ ] **Step 6: Commit.**

```
git add -A && git commit -m "feat: card label attach/detach

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5.6: Checklist (add / edit / toggle / delete / reorder)

Routes: `POST /api/cards/:id/checklist`, `PATCH /api/checklist/:id`, `DELETE /api/checklist/:id`. Reorder is a pure `position` write (verbatim); toggling `done` and editing `text` log activity, a pure reorder does not. TDD focus: checklist ordering by `(position, id)`.

**Files:** modify `server/src/routes/cards.ts` (append at sentinel); create `server/test/checklist.test.ts`.

- [ ] **Step 1: Write the failing test file `server/test/checklist.test.ts`.**

```ts
import { describe, expect, it } from 'vitest';
import { makeApp, seedUser, login } from './helpers';

async function setup() {
  const { app, db } = makeApp();
  seedUser(db, { email: 'a@x.com', name: 'Admin', password: 'pw123456', isAdmin: true });
  const cookie = await login(app, 'a@x.com', 'pw123456');
  const board = (
    await app.inject({ method: 'POST', url: '/api/boards', headers: { cookie }, payload: { name: 'Board', visibility: 'team', accentColor: 'coral' } })
  ).json();
  const listId = (await app.inject({ method: 'POST', url: `/api/boards/${board.board.id}/lists`, headers: { cookie }, payload: { name: 'L' } })).json().id;
  const cardId = (await app.inject({ method: 'POST', url: `/api/lists/${listId}/cards`, headers: { cookie }, payload: { title: 'C' } })).json().id;
  return { app, db, cookie, cardId };
}

function addItem(app: Awaited<ReturnType<typeof setup>>['app'], cookie: string, cardId: string, text: string) {
  return app.inject({ method: 'POST', url: `/api/cards/${cardId}/checklist`, headers: { cookie }, payload: { text } });
}

describe('checklist', () => {
  it('adds items and reflects them on the card', async () => {
    const { app, cookie, cardId } = await setup();
    const res = await addItem(app, cookie, cardId, 'Step 1');
    expect(res.statusCode).toBe(201);
    const card = res.json();
    expect(card.checklist).toHaveLength(1);
    expect(card.checklist[0].text).toBe('Step 1');
    expect(card.checklist[0].done).toBe(false);
  });

  it('orders checklist items by (position, id)', async () => {
    const { app, cookie, cardId } = await setup();
    const a = (await addItem(app, cookie, cardId, 'A')).json().checklist.at(-1);
    const b = (await addItem(app, cookie, cardId, 'B')).json().checklist.at(-1);
    const c = (await addItem(app, cookie, cardId, 'C')).json().checklist.at(-1);
    await app.inject({ method: 'PATCH', url: `/api/checklist/${a.id}`, headers: { cookie }, payload: { position: 'm' } });
    await app.inject({ method: 'PATCH', url: `/api/checklist/${b.id}`, headers: { cookie }, payload: { position: 'f' } });
    await app.inject({ method: 'PATCH', url: `/api/checklist/${c.id}`, headers: { cookie }, payload: { position: 't' } });
    const detail = (await app.inject({ method: 'GET', url: `/api/cards/${cardId}`, headers: { cookie } })).json();
    expect(detail.checklist.map((i: { text: string }) => i.text)).toEqual(['B', 'A', 'C']);
  });

  it('toggles and edits items with activity', async () => {
    const { app, cookie, cardId } = await setup();
    const item = (await addItem(app, cookie, cardId, 'A')).json().checklist[0];
    const toggled = await app.inject({ method: 'PATCH', url: `/api/checklist/${item.id}`, headers: { cookie }, payload: { done: true } });
    expect(toggled.json().checklist[0].done).toBe(true);
    const edited = await app.inject({ method: 'PATCH', url: `/api/checklist/${item.id}`, headers: { cookie }, payload: { text: 'A2' } });
    expect(edited.json().checklist[0].text).toBe('A2');
    const detail = (await app.inject({ method: 'GET', url: `/api/cards/${cardId}`, headers: { cookie } })).json();
    const types = detail.activity.map((x: { type: string }) => x.type);
    expect(types).toContain('card.checklist_item_toggled');
    expect(types).toContain('card.checklist_item_edited');
  });

  it('deletes an item', async () => {
    const { app, cookie, cardId } = await setup();
    const item = (await addItem(app, cookie, cardId, 'A')).json().checklist[0];
    const res = await app.inject({ method: 'DELETE', url: `/api/checklist/${item.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().checklist).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure.** `npm test -w server -- checklist` → expected: FAIL (4 failed — routes not implemented).

- [ ] **Step 3: Append the checklist handlers.** Replace the sentinel `  // CARD_ROUTES_APPEND` with:

```ts
  const addChecklistSchema = z.object({ text: z.string().trim().min(1).max(1000) });
  const patchChecklistSchema = z
    .object({
      text: z.string().trim().min(1).max(1000).optional(),
      done: z.boolean().optional(),
      position: z.string().min(1).optional(),
    })
    .refine((o) => Object.keys(o).length > 0, { message: 'nothing to update' });

  app.post('/api/cards/:id/checklist', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = addChecklistSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const card = db.select().from(cards).where(eq(cards.id, id)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const last = db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.cardId, id))
      .orderBy(desc(checklistItems.position), desc(checklistItems.id))
      .limit(1)
      .get();
    const itemId = nanoid(12);
    db.insert(checklistItems)
      .values({ id: itemId, cardId: id, text: parsed.data.text, done: false, position: positionBetween(last?.position ?? null, null) })
      .run();
    logActivity(db, { boardId: card.boardId, cardId: id, actorId: req.user.id, type: 'card.checklist_item_added', data: { itemId, text: parsed.data.text } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.code(201).send(loadCardDto(db, id)!);
  });

  app.patch('/api/checklist/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = patchChecklistSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
    const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
    if (!item) return reply.code(404).send({ error: 'checklist item not found' });
    const card = db.select().from(cards).where(eq(cards.id, item.cardId)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    const patch: Partial<typeof checklistItems.$inferInsert> = {};
    if (parsed.data.text !== undefined) patch.text = parsed.data.text;
    if (parsed.data.done !== undefined) patch.done = parsed.data.done;
    if (parsed.data.position !== undefined) patch.position = parsed.data.position;
    db.update(checklistItems).set(patch).where(eq(checklistItems.id, id)).run();

    if (parsed.data.done !== undefined)
      logActivity(db, { boardId: card.boardId, cardId: card.id, actorId: req.user.id, type: 'card.checklist_item_toggled', data: { itemId: id, done: parsed.data.done } });
    else if (parsed.data.text !== undefined)
      logActivity(db, { boardId: card.boardId, cardId: card.id, actorId: req.user.id, type: 'card.checklist_item_edited', data: { itemId: id } });

    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, card.id)!);
  });

  app.delete('/api/checklist/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = db.select().from(checklistItems).where(eq(checklistItems.id, id)).get();
    if (!item) return reply.code(404).send({ error: 'checklist item not found' });
    const card = db.select().from(cards).where(eq(cards.id, item.cardId)).get();
    if (!card) return reply.code(404).send({ error: 'card not found' });
    if (!canAccessBoard(db, req.user.id, card.boardId)) return reply.code(403).send({ error: 'forbidden' });

    db.delete(checklistItems).where(eq(checklistItems.id, id)).run();
    logActivity(db, { boardId: card.boardId, cardId: card.id, actorId: req.user.id, type: 'card.checklist_item_deleted', data: { itemId: id } });
    emit.boardChanged(card.boardId, req.user.id);
    return reply.send(loadCardDto(db, card.id)!);
  });

  // CARD_ROUTES_APPEND
```

- [ ] **Step 4: Run and confirm pass.** `npm test -w server -- checklist` → expected: 4 passed.

- [ ] **Step 5: Run the full server suite for regressions + typecheck.** `npm test -w server` → expected: all green (includes sections 2–5 suites; the 6 files added here contribute 25 passing tests). Then `npm run build -w server` → expected: exit 0 (no TS errors; confirms no unused imports and `req.user`/`RouteCtx` typings resolve).

- [ ] **Step 6: Commit.**

```
git add -A && git commit -m "feat: card checklist add/edit/toggle/delete/reorder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Section 5 done — definition of done

- `server/src/lib/email.ts` and `server/src/lib/notify.ts` exist (Task 5.0), so `cards.ts`'s `notify` import resolves; their dedicated unit tests are added later in Section 6.
- `server/src/routes/lists.ts` and `server/src/routes/cards.ts` exist and are registered in `buildApp`.
- 6 test files, 25 tests, all passing: lists (5), cards.test (4), cards-move (6), assignees (4), labels (2), checklist (4).
- Every mutation logs an `activity` row and calls `emit.boardChanged(boardId, req.user.id)`.
- Moves write `position` verbatim; cross-board `listId` is rejected (400); archived cards are excluded from `BoardDetail` (section 4 query) but still served by `GET /api/cards/:id`; adding an assignee inserts an `assigned` notification (skipped on self-assign); checklist reads are ordered by `(position, id)`.


---

## Section 6: Comments, attachments, activity, search, notifications API, email

This section builds the collaboration/back-office API surface: the comments, attachments, search, notifications, and users routes, plus the unit tests for the Resend email sender and notification helper (both files were created in Section 5, Task 5.0). All TDD, server-side (Vitest + `app.inject`).

### Preconditions (artifacts from Sections 1–5, used but not created here)

These exist because execution is in order. If a name below differs in an earlier section, reconcile to the earlier section's actual name — but the contract pins all of these:

- `server/src/app.ts` exports `interface AppDeps { db: Db; dataDir: string; emit: { boardChanged(boardId: string, byUserId: string): void } }` and `buildApp(deps: AppDeps): FastifyInstance`, whose body builds a `const ctx: RouteCtx = {...}` (Section 4 exports `type RouteCtx = AppDeps` from `./app`) and registers each route module via `registerXRoutes(app, ctx)`. Bare `db`/`dataDir`/`emit` are **not** local identifiers in `buildApp` — pass `ctx` (each register function destructures what it needs from it). If Section 1 did not `export` the `AppDeps` interface, add `export` to it (one word) — every route section imports it.
- `server/src/db/index.ts` exports `type Db` (the Drizzle better-sqlite3 database) and `createDb`.
- `server/src/db/schema.ts` exports tables `users, boards, boardMembers, lists, cards, cardAssignees, labels, cardLabels, checklistItems, comments, attachments, activity, notifications` (camelCase columns per contract).
- `server/src/lib/perms.ts` exports `requireAuth` and `requireAdmin` (Fastify preHandlers that populate `req.user: Me`) and `canAccessBoard(db, userId, boardId): boolean`. Section 3 augments `FastifyRequest` with `user: Me`.
- `server/src/lib/passwords.ts` exports `hashPassword(plain): Promise<string>` and `verifyPassword(plain, hash): Promise<boolean>`.
- `server/src/lib/email.ts` exports `sendEmail({ to, subject, html })` and `server/src/lib/notify.ts` exports `notify(db, { userId, type, cardId, actorId })` — **both created in Section 5, Task 5.0** (Section 5's `cards.ts` imports `notify`). This section does **not** create them; it only adds their unit tests (Tasks 6.1–6.2).
- `server/test/helpers.ts` exports `makeApp(): Promise<{ app, db }>` (builds via `buildApp` with a writable temp `DATA_DIR` and `createDb(':memory:')`), `seedUser(db, { email, name, password, isAdmin }): Promise<user>`, `login(app, email, password): Promise<cookie>`.
- Section 4/5 routes available for test setup: `POST /api/boards` → `BoardDetail`, `POST /api/boards/:id/lists` → `ListDto`, `POST /api/lists/:id/cards` → `CardDto`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id` (archive).

Design note (intentional): comment creation does **not** write an `activity` row and no `activity` route is added. The scope enumerates email/notify/comments/attachments/search/notifications/users; per-field activity logging is written by Sections 4/5 in their own mutations, and `activity` is surfaced only inside Section 5's `GET /api/cards/:id`. Keeping activity out of these routes is deliberate (YAGNI), not an omission.

### Files

**Created earlier (Section 5, Task 5.0) — used and tested here, not created here**
- `server/src/lib/email.ts` — Resend sender; this section adds its unit test (`email.test.ts`)
- `server/src/lib/notify.ts` — notification helper; this section adds its unit test (`notify.test.ts`)

**Create**
- `server/src/routes/comments.ts`
- `server/src/routes/attachments.ts`
- `server/src/routes/search.ts`
- `server/src/routes/notifications.ts`
- `server/src/routes/users.ts`
- `server/test/collab-helpers.ts`
- `server/test/email.test.ts`
- `server/test/notify.test.ts`
- `server/test/comments.test.ts`
- `server/test/attachments.test.ts`
- `server/test/search.test.ts`
- `server/test/notifications.test.ts`
- `server/test/users.test.ts`

**Modify**
- `server/src/app.ts` (register the 5 route modules + `@fastify/multipart`)
- `server/package.json` (add `@fastify/multipart` dependency — via `npm install`)

---

### Task 6.1: test/email.test.ts — cover the Resend sender (created in Task 5.0)

Files: `server/test/email.test.ts` (the sender `server/src/lib/email.ts` already exists from Task 5.0 — this task only adds its test).

- [ ] **Step 1: Write the test.** Create `server/test/email.test.ts`:
  ```ts
  import { describe, it, expect, vi, afterEach } from 'vitest';
  import { sendEmail } from '../src/lib/email';

  describe('sendEmail', () => {
    const origKey = process.env.RESEND_API_KEY;
    const origFrom = process.env.EMAIL_FROM;
    afterEach(() => {
      process.env.RESEND_API_KEY = origKey;
      process.env.EMAIL_FROM = origFrom;
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('no-ops (does not fetch) when RESEND_API_KEY is unset', async () => {
      delete process.env.RESEND_API_KEY;
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' }),
      ).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POSTs to the Resend API when configured', async () => {
      process.env.RESEND_API_KEY = 'key_123';
      process.env.EMAIL_FROM = 'noreply@x.com';
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, text: async () => '' });
      vi.stubGlobal('fetch', fetchMock);
      await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toBe('Bearer key_123');
      expect(JSON.parse(opts.body)).toEqual({
        from: 'noreply@x.com',
        to: 'a@b.com',
        subject: 'Hi',
        html: '<p>x</p>',
      });
    });

    it('never throws when fetch rejects', async () => {
      process.env.RESEND_API_KEY = 'key_123';
      process.env.EMAIL_FROM = 'noreply@x.com';
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
      await expect(
        sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' }),
      ).resolves.toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run — expect pass.** `npm test -w server -- email.test`
  expected: `Test Files 1 passed (1)` · `Tests 3 passed (3)` — `../src/lib/email` already exists (Task 5.0) and is correct, so the test passes on the first run.

- [ ] **Step 3: Commit.**
  ```
  git add server/test/email.test.ts
  git commit -m "$(cat <<'EOF'
  test(email): cover Resend sender (no-op unset, POST when configured, never throws)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.2: test/collab-helpers.ts + test/notify.test.ts — cover the notify helper (created in Task 5.0)

Files: `server/test/collab-helpers.ts`, `server/test/notify.test.ts` (the helper `server/src/lib/notify.ts` already exists from Task 5.0 — this task adds the shared test helper and the notify unit test).

- [ ] **Step 1: Create the shared test helper `server/test/collab-helpers.ts`** (no test of its own — pure scaffolding reused by 6.2–6.7). Full file:
  ```ts
  import type { FastifyInstance } from 'fastify';

  export async function createBoard(
    app: FastifyInstance,
    cookie: string,
    visibility: 'team' | 'private' = 'team',
    name = 'Test Board',
  ): Promise<{ boardId: string; listId: string }> {
    const b = await app.inject({
      method: 'POST',
      url: '/api/boards',
      headers: { cookie },
      payload: { name, visibility, accentColor: 'coral' },
    });
    const boardId = b.json().board.id;
    const l = await app.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/lists`,
      headers: { cookie },
      payload: { name: 'List 1' },
    });
    const listId = l.json().id;
    return { boardId, listId };
  }

  export async function createCard(
    app: FastifyInstance,
    cookie: string,
    listId: string,
    title = 'A card',
  ): Promise<string> {
    const c = await app.inject({
      method: 'POST',
      url: `/api/lists/${listId}/cards`,
      headers: { cookie },
      payload: { title },
    });
    return c.json().id;
  }
  ```

- [ ] **Step 2: Write the test `server/test/notify.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { eq } from 'drizzle-orm';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';
  import { notify } from '../src/lib/notify';
  import { notifications, users } from '../src/db/schema';

  describe('notify', () => {
    it('inserts a notification row', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId);

      notify(db, { userId: bob.id, type: 'assigned', cardId, actorId: null });

      const rows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('assigned');
      expect(rows[0].cardId).toBe(cardId);
      expect(rows[0].readAt).toBeNull();
    });

    it('still inserts the row when the user disabled email notifications', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      db.update(users).set({ emailNotifications: false }).where(eq(users.id, bob.id)).run();
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId);

      notify(db, { userId: bob.id, type: 'mentioned', cardId, actorId: null });

      const rows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      expect(rows).toHaveLength(1);
    });
  });
  ```

- [ ] **Step 3: Run — expect pass.** `npm test -w server -- notify.test`
  expected: `Test Files 1 passed (1)` · `Tests 2 passed (2)` — `../src/lib/notify` already exists (Task 5.0) and is correct, so the test passes on the first run.

- [ ] **Step 4: Commit.**
  ```
  git add server/test/collab-helpers.ts server/test/notify.test.ts
  git commit -m "$(cat <<'EOF'
  test(notify): cover row-first notification helper + add shared collab test helpers

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.3: routes/comments.ts — create comment, parse @[userId] mentions, notify

Files: `server/src/routes/comments.ts`, `server/test/comments.test.ts`, `server/src/app.ts` (modify)

Notification rules implemented: parse `@[userId]` → notify `mentioned` (only ids that resolve to real users); then card creator + assignees → `comment_on_your_card`; never notify the author; never notify the same user twice (mention wins over comment_on_your_card).

- [ ] **Step 1: Write the failing test `server/test/comments.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { eq } from 'drizzle-orm';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';
  import { parseMentions } from '../src/routes/comments';
  import { notifications, cardAssignees } from '../src/db/schema';

  describe('parseMentions', () => {
    it('extracts mention ids in order', () => {
      expect(parseMentions('hey @[abc123] and @[xyz789]')).toEqual(['abc123', 'xyz789']);
    });
    it('dedupes repeated mentions', () => {
      expect(parseMentions('@[dup] then @[dup]')).toEqual(['dup']);
    });
    it('returns empty when there are no mentions', () => {
      expect(parseMentions('nothing to see here')).toEqual([]);
    });
    it('ignores empty brackets', () => {
      expect(parseMentions('@[] hello')).toEqual([]);
    });
    it('handles ids with dashes and underscores', () => {
      expect(parseMentions('@[a-b_c9]')).toEqual(['a-b_c9']);
    });
  });

  describe('POST /api/cards/:id/comments', () => {
    async function setup() {
      const { app, db } = await makeApp();
      const alice = await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const carol = await seedUser(db, { email: 'c@x.com', name: 'Carol', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie); // team board, created by Alice
      const cardId = await createCard(app, cookie, listId); // created by Alice
      return { app, db, alice, bob, carol, cookie, cardId };
    }

    it('creates a comment and returns it', async () => {
      const { app, cookie, cardId } = await setup();
      const res = await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie },
        payload: { body: 'Hello world' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().body).toBe('Hello world');
      expect(res.json().cardId).toBe(cardId);
    });

    it('notifies mentioned users', async () => {
      const { app, db, bob, cookie, cardId } = await setup();
      await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie },
        payload: { body: `hey @[${bob.id}]` },
      });
      const rows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('mentioned');
    });

    it('does not notify for a mention of a non-existent user', async () => {
      const { app, db, cookie, cardId } = await setup();
      await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie },
        payload: { body: 'hey @[ghost0000000]' },
      });
      expect(db.select().from(notifications).all()).toHaveLength(0);
    });

    it('notifies card creator and assignees with comment_on_your_card', async () => {
      const { app, db, alice, bob, carol, cardId } = await setup();
      db.insert(cardAssignees).values({ cardId, userId: bob.id }).run();
      const carolCookie = await login(app, 'c@x.com', 'password123');
      await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie: carolCookie },
        payload: { body: 'nice work' },
      });
      const bobRows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      const aliceRows = db.select().from(notifications).where(eq(notifications.userId, alice.id)).all();
      const carolRows = db.select().from(notifications).where(eq(notifications.userId, carol.id)).all();
      expect(bobRows.filter((r) => r.type === 'comment_on_your_card')).toHaveLength(1);
      expect(aliceRows.filter((r) => r.type === 'comment_on_your_card')).toHaveLength(1);
      expect(carolRows).toHaveLength(0);
    });

    it('never notifies the author, even when self-mentioned (author is also the creator)', async () => {
      const { app, db, alice, cookie, cardId } = await setup();
      await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie },
        payload: { body: `note to self @[${alice.id}]` },
      });
      const rows = db.select().from(notifications).where(eq(notifications.userId, alice.id)).all();
      expect(rows).toHaveLength(0);
    });

    it('does not double-notify a mentioned assignee (mention wins)', async () => {
      const { app, db, bob, cardId } = await setup();
      db.insert(cardAssignees).values({ cardId, userId: bob.id }).run();
      const carolCookie = await login(app, 'c@x.com', 'password123');
      await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie: carolCookie },
        payload: { body: `@[${bob.id}] please look` },
      });
      const bobRows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      expect(bobRows).toHaveLength(1);
      expect(bobRows[0].type).toBe('mentioned');
    });

    it('rejects a blank comment body with 400', async () => {
      const { app, cookie, cardId } = await setup();
      const res = await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/comments`,
        headers: { cookie },
        payload: { body: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for an unknown card', async () => {
      const { app, cookie } = await setup();
      const res = await app.inject({
        method: 'POST',
        url: `/api/cards/nope00000000/comments`,
        headers: { cookie },
        payload: { body: 'hi' },
      });
      expect(res.statusCode).toBe(404);
    });
  });
  ```

- [ ] **Step 2: Run — expect fail (module missing).** `npm test -w server -- comments.test`
  expected: FAIL — `Failed to resolve import "../src/routes/comments"`.

- [ ] **Step 3: Implement `server/src/routes/comments.ts`.** Full file:
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { z } from 'zod';
  import { nanoid } from 'nanoid';
  import { eq, inArray } from 'drizzle-orm';
  import { requireAuth, canAccessBoard } from '../lib/perms';
  import { comments, cards, cardAssignees, users } from '../db/schema';
  import { notify } from '../lib/notify';
  import type { AppDeps } from '../app';
  import type { CommentDto } from '@shared/types';

  const bodySchema = z.object({ body: z.string().trim().min(1).max(10000) });

  const MENTION_RE = /@\[([A-Za-z0-9_-]+)\]/g;

  export function parseMentions(body: string): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const m of body.matchAll(MENTION_RE)) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        ids.push(m[1]);
      }
    }
    return ids;
  }

  export function registerCommentRoutes(app: FastifyInstance, { db, emit }: AppDeps): void {
    app.post('/api/cards/:id/comments', { preHandler: requireAuth }, async (req, reply) => {
      const cardId = (req.params as { id: string }).id;
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid comment' });

      const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
      if (!card) return reply.code(404).send({ error: 'Card not found' });
      if (!canAccessBoard(db, req.user.id, card.boardId)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const authorId = req.user.id;
      const now = new Date().toISOString();
      const id = nanoid(12);
      db.insert(comments)
        .values({ id, cardId, authorId, body: parsed.data.body, createdAt: now })
        .run();

      const notified = new Set<string>([authorId]); // never self-notify, never double-notify

      const mentionIds = parseMentions(parsed.data.body);
      if (mentionIds.length) {
        const realIds = new Set(
          db.select({ id: users.id }).from(users).where(inArray(users.id, mentionIds)).all().map((u) => u.id),
        );
        for (const uid of mentionIds) {
          if (realIds.has(uid) && !notified.has(uid)) {
            notify(db, { userId: uid, type: 'mentioned', cardId, actorId: authorId });
            notified.add(uid);
          }
        }
      }

      const assigneeIds = db
        .select({ userId: cardAssignees.userId })
        .from(cardAssignees)
        .where(eq(cardAssignees.cardId, cardId))
        .all()
        .map((a) => a.userId);
      for (const uid of [card.createdBy, ...assigneeIds]) {
        if (!notified.has(uid)) {
          notify(db, { userId: uid, type: 'comment_on_your_card', cardId, actorId: authorId });
          notified.add(uid);
        }
      }

      emit.boardChanged(card.boardId, authorId);

      const dto: CommentDto = { id, cardId, authorId, body: parsed.data.body, createdAt: now };
      return reply.code(201).send(dto);
    });
  }
  ```

- [ ] **Step 4: Register in `server/src/app.ts`.** Add the import beside the other route imports:
  ```ts
  import { registerCommentRoutes } from './routes/comments';
  ```
  And add this line where the other `registerXxxRoutes(app, ctx)` calls are inside `buildApp` (after auth/session setup so `requireAuth` works). Pass the existing `ctx` (the `RouteCtx` Section 4 builds), matching Sections 4/5 — `registerCommentRoutes` destructures `{ db, emit }` from it:
  ```ts
  registerCommentRoutes(app, ctx);
  ```

- [ ] **Step 5: Run — expect pass.** `npm test -w server -- comments.test`
  expected: `Test Files 1 passed (1)` · `Tests 13 passed (13)`.

- [ ] **Step 6: Commit.**
  ```
  git add server/src/routes/comments.ts server/src/app.ts server/test/comments.test.ts
  git commit -m "$(cat <<'EOF'
  feat(comments): create comments with @mention + creator/assignee notifications

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.4: routes/attachments.ts — multipart upload ≤20MB, auth download, delete

Files: `server/package.json` (add dep), `server/src/routes/attachments.ts`, `server/test/attachments.test.ts`, `server/src/app.ts` (modify)

- [ ] **Step 1: Install the multipart plugin.** `npm install @fastify/multipart -w server`
  expected: adds `@fastify/multipart` to `server/package.json` dependencies; `added 1 package` (or reuses existing).

- [ ] **Step 2: Write the failing test `server/test/attachments.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';

  const BOUNDARY = '----vitestboundary';

  function multipart(filename: string, content: Buffer, contentType = 'application/octet-stream') {
    const head = Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
    return Buffer.concat([head, content, tail]);
  }

  const mpHeaders = (cookie: string) => ({
    cookie,
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
  });

  async function setup() {
    const { app, db } = await makeApp();
    await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
    const cookie = await login(app, 'a@x.com', 'password123');
    const { listId } = await createBoard(app, cookie);
    const cardId = await createCard(app, cookie, listId);
    return { app, db, cookie, listId, cardId };
  }

  describe('attachments', () => {
    it('uploads and downloads a file with Content-Disposition: attachment', async () => {
      const { app, cookie, cardId } = await setup();
      const up = await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/attachments`,
        headers: mpHeaders(cookie),
        payload: multipart('hello.txt', Buffer.from('hello world'), 'text/plain'),
      });
      expect(up.statusCode).toBe(201);
      const att = up.json();
      expect(att.filename).toBe('hello.txt');
      expect(att.sizeBytes).toBe(11);
      expect(att.mime).toBe('text/plain');

      const dl = await app.inject({ method: 'GET', url: `/api/attachments/${att.id}`, headers: { cookie } });
      expect(dl.statusCode).toBe(200);
      expect(dl.headers['content-disposition']).toContain('attachment');
      expect(dl.body).toBe('hello world');
    });

    it('deletes an attachment', async () => {
      const { app, cookie, cardId } = await setup();
      const up = await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/attachments`,
        headers: mpHeaders(cookie),
        payload: multipart('gone.txt', Buffer.from('bye'), 'text/plain'),
      });
      const att = up.json();
      const del = await app.inject({ method: 'DELETE', url: `/api/attachments/${att.id}`, headers: { cookie } });
      expect(del.statusCode).toBe(204);
      const dl = await app.inject({ method: 'GET', url: `/api/attachments/${att.id}`, headers: { cookie } });
      expect(dl.statusCode).toBe(404);
    });

    it('rejects files larger than 20MB with 400', async () => {
      const { app, cookie, cardId } = await setup();
      const big = Buffer.alloc(21 * 1024 * 1024, 1);
      const res = await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/attachments`,
        headers: mpHeaders(cookie),
        payload: multipart('big.bin', big),
      });
      expect(res.statusCode).toBe(400);
    });

    it('forbids download for a user without board access', async () => {
      const { app, db, cookie } = await setup();
      await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie, 'private');
      const cardId = await createCard(app, cookie, listId);
      const up = await app.inject({
        method: 'POST',
        url: `/api/cards/${cardId}/attachments`,
        headers: mpHeaders(cookie),
        payload: multipart('secret.txt', Buffer.from('secret'), 'text/plain'),
      });
      const att = up.json();
      const bobCookie = await login(app, 'b@x.com', 'password123');
      const dl = await app.inject({ method: 'GET', url: `/api/attachments/${att.id}`, headers: { cookie: bobCookie } });
      expect(dl.statusCode).toBe(403);
    });
  });
  ```

- [ ] **Step 3: Run — expect fail (route not registered).** `npm test -w server -- attachments.test`
  expected: FAIL — upload returns 404 (no route yet), `Tests 4 failed`.

- [ ] **Step 4: Implement `server/src/routes/attachments.ts`.** Full file:
  ```ts
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

  const MAX_BYTES = 20 * 1024 * 1024;

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
  ```

- [ ] **Step 5: Register plugin + routes in `server/src/app.ts`.** Add imports beside the other imports:
  ```ts
  import multipart from '@fastify/multipart';
  import { registerAttachmentRoutes } from './routes/attachments';
  ```
  Inside `buildApp`, register the plugin **before** the route registrations:
  ```ts
  app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 }, throwFileSizeLimit: false });
  ```
  And add the route registration beside the others, passing the existing `ctx` (matching Sections 4/5; `registerAttachmentRoutes` destructures `{ db, dataDir, emit }` from it):
  ```ts
  registerAttachmentRoutes(app, ctx);
  ```

- [ ] **Step 6: Run — expect pass.** `npm test -w server -- attachments.test`
  expected: `Test Files 1 passed (1)` · `Tests 4 passed (4)`.

- [ ] **Step 7: Commit.**
  ```
  git add server/package.json server/package-lock.json server/src/routes/attachments.ts server/src/app.ts server/test/attachments.test.ts
  git commit -m "$(cat <<'EOF'
  feat(attachments): multipart upload (20MB cap), auth download, delete

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.5: routes/search.ts — LIKE over accessible non-archived boards/cards, ≤20

Files: `server/src/routes/search.ts`, `server/test/search.test.ts`, `server/src/app.ts` (modify)

- [ ] **Step 1: Write the failing test `server/test/search.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';

  describe('GET /api/search', () => {
    it('finds cards by title and description on accessible boards', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const { listId } = await createBoard(app, cookie);
      await createCard(app, cookie, listId, 'Buy milk');
      const c2 = await createCard(app, cookie, listId, 'Groceries');
      await app.inject({
        method: 'PATCH',
        url: `/api/cards/${c2}`,
        headers: { cookie },
        payload: { description: 'remember the milk' },
      });

      const res = await app.inject({ method: 'GET', url: '/api/search?q=milk', headers: { cookie } });
      expect(res.statusCode).toBe(200);
      const results = res.json();
      expect(results.map((r: any) => r.title).sort()).toEqual(['Buy milk', 'Groceries']);
      expect(results[0].boardName).toBe('Test Board');
      expect(results[0].listName).toBe('List 1');
    });

    it('excludes cards on private boards the user cannot access', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const aliceCookie = await login(app, 'a@x.com', 'password123');
      await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const bobCookie = await login(app, 'b@x.com', 'password123');
      const { listId } = await createBoard(app, aliceCookie, 'private');
      await createCard(app, aliceCookie, listId, 'Secret milk plan');
      const res = await app.inject({ method: 'GET', url: '/api/search?q=milk', headers: { cookie: bobCookie } });
      expect(res.json()).toEqual([]);
    });

    it('caps results at 20', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const { listId } = await createBoard(app, cookie);
      for (let i = 0; i < 21; i++) await createCard(app, cookie, listId, `milk ${i}`);
      const res = await app.inject({ method: 'GET', url: '/api/search?q=milk', headers: { cookie } });
      expect(res.json()).toHaveLength(20);
    });

    it('excludes archived cards', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId, 'milk to archive');
      await app.inject({ method: 'DELETE', url: `/api/cards/${cardId}`, headers: { cookie } });
      const res = await app.inject({ method: 'GET', url: '/api/search?q=milk', headers: { cookie } });
      expect(res.json()).toEqual([]);
    });

    it('returns empty for a blank query', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const res = await app.inject({ method: 'GET', url: '/api/search?q=', headers: { cookie } });
      expect(res.json()).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run — expect fail (route not registered).** `npm test -w server -- search.test`
  expected: FAIL — search returns 404, `Tests 5 failed`.

- [ ] **Step 3: Implement `server/src/routes/search.ts`.** Full file:
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { and, or, eq, like, isNull, inArray, desc } from 'drizzle-orm';
  import { requireAuth } from '../lib/perms';
  import { boards, boardMembers, lists, cards } from '../db/schema';
  import type { Db } from '../db/index';
  import type { AppDeps } from '../app';
  import type { Me, SearchResult } from '@shared/types';

  function accessibleBoardIds(db: Db, user: Me): string[] {
    const all = db
      .select({ id: boards.id, visibility: boards.visibility })
      .from(boards)
      .where(isNull(boards.archivedAt))
      .all();
    if (user.isAdmin) return all.map((b) => b.id);
    const memberOf = new Set(
      db.select({ boardId: boardMembers.boardId }).from(boardMembers).where(eq(boardMembers.userId, user.id)).all().map((r) => r.boardId),
    );
    return all.filter((b) => b.visibility === 'team' || memberOf.has(b.id)).map((b) => b.id);
  }

  export function registerSearchRoutes(app: FastifyInstance, { db }: AppDeps): void {
    app.get('/api/search', { preHandler: requireAuth }, async (req, reply) => {
      const q = String((req.query as { q?: string }).q ?? '').trim();
      if (!q) return reply.send([]);

      const boardIds = accessibleBoardIds(db, req.user);
      if (boardIds.length === 0) return reply.send([]);

      const pattern = `%${q}%`;
      const rows = db
        .select({
          cardId: cards.id,
          boardId: cards.boardId,
          title: cards.title,
          boardName: boards.name,
          listName: lists.name,
        })
        .from(cards)
        .innerJoin(boards, eq(boards.id, cards.boardId))
        .innerJoin(lists, eq(lists.id, cards.listId))
        .where(
          and(
            inArray(cards.boardId, boardIds),
            isNull(cards.archivedAt),
            isNull(lists.archivedAt),
            or(like(cards.title, pattern), like(cards.description, pattern)),
          ),
        )
        .orderBy(desc(cards.updatedAt))
        .limit(20)
        .all();

      return reply.send(rows satisfies SearchResult[]);
    });
  }
  ```

- [ ] **Step 4: Register in `server/src/app.ts`.** Add the import and the register call beside the others:
  ```ts
  import { registerSearchRoutes } from './routes/search';
  ```
  Pass the existing `ctx` (matching Sections 4/5; `registerSearchRoutes` destructures `{ db }` from it):
  ```ts
  registerSearchRoutes(app, ctx);
  ```

- [ ] **Step 5: Run — expect pass.** `npm test -w server -- search.test`
  expected: `Test Files 1 passed (1)` · `Tests 5 passed (5)`.

- [ ] **Step 6: Commit.**
  ```
  git add server/src/routes/search.ts server/src/app.ts server/test/search.test.ts
  git commit -m "$(cat <<'EOF'
  feat(search): title/description LIKE over accessible non-archived cards

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.6: routes/notifications.ts — latest 50 with joins, mark read (ids or all)

Files: `server/src/routes/notifications.ts`, `server/test/notifications.test.ts`, `server/src/app.ts` (modify)

- [ ] **Step 1: Write the failing test `server/test/notifications.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { eq } from 'drizzle-orm';
  import { nanoid } from 'nanoid';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';
  import { notifications } from '../src/db/schema';

  function seedNotif(
    db: any,
    userId: string,
    cardId: string,
    over: Partial<{ type: string; actorId: string | null; readAt: string | null }> = {},
  ): string {
    const id = nanoid(12);
    db.insert(notifications)
      .values({
        id,
        userId,
        type: over.type ?? 'assigned',
        cardId,
        actorId: over.actorId ?? null,
        readAt: over.readAt ?? null,
        createdAt: new Date().toISOString(),
      })
      .run();
    return id;
  }

  describe('notifications', () => {
    it('returns the latest 50 with card title, board id, and actor name', async () => {
      const { app, db } = await makeApp();
      const alice = await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId, 'Card X');
      for (let i = 0; i < 51; i++) seedNotif(db, bob.id, cardId, { actorId: alice.id });

      const bobCookie = await login(app, 'b@x.com', 'password123');
      const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: bobCookie } });
      const list = res.json();
      expect(list).toHaveLength(50);
      expect(list[0].cardTitle).toBe('Card X');
      expect(list[0].boardId).toBeTruthy();
      expect(list[0].actorName).toBe('Alice');
    });

    it('returns actorName null when actorId is null', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId);
      seedNotif(db, bob.id, cardId, { type: 'due_soon', actorId: null });
      const bobCookie = await login(app, 'b@x.com', 'password123');
      const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie: bobCookie } });
      expect(res.json()[0].actorName).toBeNull();
    });

    it('marks specific notifications read by id', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId);
      const id1 = seedNotif(db, bob.id, cardId);
      seedNotif(db, bob.id, cardId);
      const bobCookie = await login(app, 'b@x.com', 'password123');
      const res = await app.inject({
        method: 'POST',
        url: '/api/notifications/read',
        headers: { cookie: bobCookie },
        payload: { ids: [id1] },
      });
      expect(res.statusCode).toBe(204);
      const rows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      expect(rows.find((r) => r.id === id1)!.readAt).not.toBeNull();
      expect(rows.filter((r) => r.readAt === null)).toHaveLength(1);
    });

    it('marks all read when ids are omitted', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId);
      seedNotif(db, bob.id, cardId);
      seedNotif(db, bob.id, cardId);
      const bobCookie = await login(app, 'b@x.com', 'password123');
      await app.inject({ method: 'POST', url: '/api/notifications/read', headers: { cookie: bobCookie }, payload: {} });
      const rows = db.select().from(notifications).where(eq(notifications.userId, bob.id)).all();
      expect(rows.every((r) => r.readAt !== null)).toBe(true);
    });

    it("does not let a user mark another user's notification read", async () => {
      const { app, db } = await makeApp();
      const alice = await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: true });
      const cookie = await login(app, 'a@x.com', 'password123');
      const bob = await seedUser(db, { email: 'b@x.com', name: 'Bob', password: 'password123', isAdmin: false });
      const { listId } = await createBoard(app, cookie);
      const cardId = await createCard(app, cookie, listId);
      const bobNotif = seedNotif(db, bob.id, cardId);
      await app.inject({
        method: 'POST',
        url: '/api/notifications/read',
        headers: { cookie }, // Alice
        payload: { ids: [bobNotif] },
      });
      const row = db.select().from(notifications).where(eq(notifications.id, bobNotif)).get()!;
      expect(row.readAt).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run — expect fail (route not registered).** `npm test -w server -- notifications.test`
  expected: FAIL — GET returns 404, `Tests 5 failed`.

- [ ] **Step 3: Implement `server/src/routes/notifications.ts`.** Full file:
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { z } from 'zod';
  import { and, eq, isNull, inArray, desc } from 'drizzle-orm';
  import { alias } from 'drizzle-orm/sqlite-core';
  import { requireAuth } from '../lib/perms';
  import { notifications, cards, users } from '../db/schema';
  import type { AppDeps } from '../app';
  import type { NotificationDto } from '@shared/types';

  const readSchema = z.object({ ids: z.array(z.string()).optional() });

  export function registerNotificationRoutes(app: FastifyInstance, { db }: AppDeps): void {
    const actor = alias(users, 'actor');

    app.get('/api/notifications', { preHandler: requireAuth }, async (req, reply) => {
      const rows = db
        .select({
          id: notifications.id,
          type: notifications.type,
          cardId: notifications.cardId,
          cardTitle: cards.title,
          boardId: cards.boardId,
          actorId: notifications.actorId,
          actorName: actor.name,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .innerJoin(cards, eq(cards.id, notifications.cardId))
        .leftJoin(actor, eq(actor.id, notifications.actorId))
        .where(eq(notifications.userId, req.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50)
        .all();
      return reply.send(rows as NotificationDto[]);
    });

    app.post('/api/notifications/read', { preHandler: requireAuth }, async (req, reply) => {
      const parsed = readSchema.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
      const now = new Date().toISOString();
      const ids = parsed.data.ids;
      if (ids && ids.length) {
        db.update(notifications)
          .set({ readAt: now })
          .where(and(eq(notifications.userId, req.user.id), inArray(notifications.id, ids), isNull(notifications.readAt)))
          .run();
      } else {
        db.update(notifications)
          .set({ readAt: now })
          .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)))
          .run();
      }
      return reply.code(204).send();
    });
  }
  ```

- [ ] **Step 4: Register in `server/src/app.ts`.** Add the import and the register call beside the others:
  ```ts
  import { registerNotificationRoutes } from './routes/notifications';
  ```
  Pass the existing `ctx` (matching Sections 4/5; `registerNotificationRoutes` destructures `{ db }` from it):
  ```ts
  registerNotificationRoutes(app, ctx);
  ```

- [ ] **Step 5: Run — expect pass.** `npm test -w server -- notifications.test`
  expected: `Test Files 1 passed (1)` · `Tests 5 passed (5)`.

- [ ] **Step 6: Commit.**
  ```
  git add server/src/routes/notifications.ts server/src/app.ts server/test/notifications.test.ts
  git commit -m "$(cat <<'EOF'
  feat(notifications): list latest 50 with joins and mark-read (ids or all)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6.7: routes/users.ts — PATCH me, change password (verifies current)

Files: `server/src/routes/users.ts`, `server/test/users.test.ts`, `server/src/app.ts` (modify)

- [ ] **Step 1: Write the failing test `server/test/users.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { makeApp, seedUser, login } from './helpers';

  describe('users self-service', () => {
    it('updates name, avatar color, and email notifications', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: false });
      const cookie = await login(app, 'a@x.com', 'password123');
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: { cookie },
        payload: { name: 'Alice B', avatarColor: 'teal', emailNotifications: false },
      });
      expect(res.statusCode).toBe(200);
      const me = res.json();
      expect(me.name).toBe('Alice B');
      expect(me.avatarColor).toBe('teal');
      expect(me.emailNotifications).toBe(false);
    });

    it('rejects an invalid avatar color', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: false });
      const cookie = await login(app, 'a@x.com', 'password123');
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/me',
        headers: { cookie },
        payload: { avatarColor: 'chartreuse' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('changes the password when the current one is correct', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: false });
      const cookie = await login(app, 'a@x.com', 'password123');
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: { cookie },
        payload: { currentPassword: 'password123', newPassword: 'newpassword456' },
      });
      expect(res.statusCode).toBe(204);
      const newCookie = await login(app, 'a@x.com', 'newpassword456');
      expect(newCookie).toBeTruthy();
    });

    it('rejects a password change with the wrong current password', async () => {
      const { app, db } = await makeApp();
      await seedUser(db, { email: 'a@x.com', name: 'Alice', password: 'password123', isAdmin: false });
      const cookie = await login(app, 'a@x.com', 'password123');
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/password',
        headers: { cookie },
        payload: { currentPassword: 'wrongpass', newPassword: 'newpassword456' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run — expect fail (route not registered).** `npm test -w server -- users.test`
  expected: FAIL — PATCH returns 404, `Tests 4 failed`.

- [ ] **Step 3: Implement `server/src/routes/users.ts`.** Full file:
  ```ts
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
      const ok = await verifyPassword(parsed.data.currentPassword, u.passwordHash);
      if (!ok) return reply.code(400).send({ error: 'Current password is incorrect' });

      const hash = await hashPassword(parsed.data.newPassword);
      db.update(users).set({ passwordHash: hash }).where(eq(users.id, req.user.id)).run();
      return reply.code(204).send();
    });
  }
  ```

- [ ] **Step 4: Register in `server/src/app.ts`.** Add the import and the register call beside the others:
  ```ts
  import { registerUserRoutes } from './routes/users';
  ```
  Pass the existing `ctx` (matching Sections 4/5; `registerUserRoutes` destructures `{ db }` from it):
  ```ts
  registerUserRoutes(app, ctx);
  ```

- [ ] **Step 5: Run — expect pass.** `npm test -w server -- users.test`
  expected: `Test Files 1 passed (1)` · `Tests 4 passed (4)`.

- [ ] **Step 6: Run the whole server suite to confirm nothing regressed.** `npm test -w server`
  expected: all server test files pass, including this section's `email`, `notify`, `comments`, `attachments`, `search`, `notifications`, `users` (33 new tests green) alongside Sections 1–5.

- [ ] **Step 7: Commit.**
  ```
  git add server/src/routes/users.ts server/src/app.ts server/test/users.test.ts
  git commit -m "$(cat <<'EOF'
  feat(users): PATCH profile and change-password with current-password check

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```


---

## Section 7: Socket.IO realtime, presence, scheduled jobs, admin routes

This section adds the realtime layer (`server/src/realtime.ts`), the scheduled jobs (`server/src/jobs.ts`), and the admin routes (`server/src/routes/admin.ts`), then wires realtime + jobs into `server/src/index.ts`. All server logic is TDD (Vitest). Imports are extensionless throughout (the repo tsconfig uses `moduleResolution: "bundler"`, per Section 1; Section 6 established this style for route/lib modules).

### Preconditions (artifacts from Sections 1–6, used but not created here)

Execution runs in order, so these already exist. Reconcile to the earlier section's actual name if it ever differs — the contract pins all of them:

- `server/src/app.ts` exports `interface AppDeps { db: Db; dataDir: string; emit: Emit }`, `interface Emit { boardChanged(boardId: string, byUserId: string): void }`, and `buildApp(deps: AppDeps): FastifyInstance`. Inside `buildApp`, Section 4 established `const ctx: RouteCtx = { db: deps.db, dataDir: deps.dataDir, emit: deps.emit }` (`type RouteCtx = AppDeps`, exported from `./app`) and registers each route module via `registerXRoutes(app, ctx)`; bare `db`/`dataDir`/`emit` are **not** local identifiers in `buildApp` (each register function destructures what it needs from `ctx`). It also registers `@fastify/cookie` at the top level and augments `FastifyRequest` with `user: Me`.
- `server/src/index.ts` (Section 3 shape): `mkdirSync(dataDir)` → `createDb(\`${dataDir}/app.db\`)` → `firstRunBootstrap(db)` → `buildApp({ db, dataDir, emit })` → `app.listen(...)`. This section replaces the tail so realtime + jobs are wired in.
- `server/src/db/index.ts` exports `createDb(path | ':memory:') → { db, sqlite }` and `type Db` (the Drizzle better-sqlite3 database). `sqlite` is the raw better-sqlite3 handle (has `.backup(dest)`).
- `server/src/db/schema.ts` exports tables `users, sessions, invites, passwordResets, boards, boardMembers, lists, cards, cardAssignees, labels, cardLabels, checklistItems, comments, attachments, activity, notifications` (camelCase columns per contract).
- `server/src/lib/perms.ts` exports `requireAuth`, `requireAdmin` (Fastify preHandlers populating `req.user: Me`), `canAccessBoard(db, userId, boardId): boolean`, `toUserPublic(userRow): UserPublic`, `createSession(db, userId): string`, `revokeUserSessions(db, userId): void`, and `SESSION_COOKIE` (= `'sid'`).
- `server/src/lib/notify.ts` exports `notify(db, { userId, type, cardId, actorId }): void` — inserts a `notifications` row then fires a best-effort email (skipped when the recipient disabled email or Resend is unconfigured; never throws).
- `server/src/lib/email.ts` exports `sendEmail({ to, subject, html }): Promise<void>` — no-op + log when `RESEND_API_KEY`/`EMAIL_FROM` unset; never throws.
- `server/test/helpers.ts` exports `makeApp(): { app, db }` (builds via `buildApp` with `dataDir: '/tmp/company-trello-test'` and `createDb(':memory:')`), `seedUser(db, { email, name, password, isAdmin? }): { id, email, name, isAdmin }`, `login(app, email, password): Promise<string>` (returns the `sid=…` cookie header value).
- `server/test/collab-helpers.ts` exports `createBoard(app, cookie, visibility?, name?): Promise<{ boardId, listId }>` and `createCard(app, cookie, listId, title?): Promise<string>` (Section 6).
- Section 4/5 routes available for test setup: `POST /api/boards` → `BoardDetail`, `POST /api/boards/:id/lists` → `ListDto`, `POST /api/lists/:id/cards` → `CardDto`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id` (archive), `DELETE /api/boards/:id` (archive), `POST /api/cards/:id/attachments` (multipart).

### Files

**Create**
- `server/src/realtime.ts` — `setupRealtime(server, db) → { io, emitBoardChanged }`
- `server/src/jobs.ts` — `runDueSoon(db, now?)`, `runBackup(sqlite, dataDir, now?)`, `startJobs({ db, sqlite, dataDir })`
- `server/src/routes/admin.ts` — `registerAdminRoutes(app, deps)`: invites, members, deactivate/promote, reset-password, purge
- `server/test/realtime.test.ts`
- `server/test/jobs-duesoon.test.ts`
- `server/test/jobs-backup.test.ts`
- `server/test/admin-invites.test.ts`
- `server/test/admin-members.test.ts`
- `server/test/admin-purge.test.ts`
- `server/test/admin-archived.test.ts`

**Modify**
- `server/package.json` — add `socket.io`, `aws4fetch` (deps) and `socket.io-client` (devDep) via `npm install`
- `server/src/app.ts` — register admin routes
- `server/src/index.ts` — wire `setupRealtime` + `startJobs`

### Response shape defined here (no shared DTO)

`GET /api/admin/members` returns `{ members: UserPublic[]; diskUsageBytes: number; emailConfigured: boolean }` (members includes deactivated users; `diskUsageBytes` is the summed `attachments.size_bytes` across all cards; `emailConfigured` is `!!(RESEND_API_KEY && EMAIL_FROM)`, so the admin page can show an accurate "email not configured" notice). `GET /api/admin/archived-boards` returns `BoardSummary[]` (boards with `archived_at != null`). `POST /api/admin/restore {entity:'board', id}` un-archives a board (symmetric with `POST /api/admin/purge`). Section 11 (admin page) consumes these shapes.

---

### Task 7.1: realtime.ts — cookie-auth handshake, board rooms, presence

Files: `server/package.json`, `server/src/realtime.ts`, `server/test/realtime.test.ts`

- [ ] **Step 1: Install the socket dependencies.**
  ```bash
  npm install -w server socket.io@^4 && npm install -w server -D socket.io-client@^4
  ```
  Expected: `server/package.json` gains `socket.io` under `dependencies` and `socket.io-client` under `devDependencies`; install completes with no errors.

- [ ] **Step 2: Write the failing test** `server/test/realtime.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { createServer, type Server as HttpServer } from 'node:http';
  import type { AddressInfo } from 'node:net';
  import { io as ioClient, type Socket } from 'socket.io-client';
  import { nanoid } from 'nanoid';
  import { createDb } from '../src/db/index';
  import * as schema from '../src/db/schema';
  import { createSession } from '../src/lib/perms';
  import { setupRealtime } from '../src/realtime';

  type Db = ReturnType<typeof createDb>['db'];

  let httpServer: HttpServer;
  let realtime: ReturnType<typeof setupRealtime>;
  let db: Db;
  let port: number;
  const clients: Socket[] = [];

  function mkUser(over: { name?: string; avatarColor?: string } = {}): string {
    const id = nanoid(12);
    db.insert(schema.users).values({
      id,
      email: `${id}@x.com`,
      name: over.name ?? 'U',
      passwordHash: 'x',
      avatarColor: over.avatarColor ?? 'coral',
      isAdmin: false,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    return id;
  }

  function mkBoard(visibility: 'team' | 'private', createdBy: string): string {
    const id = nanoid(12);
    db.insert(schema.boards).values({
      id,
      name: 'B',
      accentColor: 'coral',
      visibility,
      createdBy,
      archivedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    return id;
  }

  function connect(token?: string): Socket {
    const socket = ioClient(`http://localhost:${port}`, {
      reconnection: false,
      forceNew: true,
      extraHeaders: token ? { cookie: `sid=${token}` } : {},
    });
    clients.push(socket);
    return socket;
  }

  function once<T = unknown>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve) => socket.once(event, resolve as (v: T) => void));
  }

  function receivedWithin(socket: Socket, event: string, ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      socket.once(event, () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  beforeEach(async () => {
    db = createDb(':memory:').db;
    httpServer = createServer();
    realtime = setupRealtime(httpServer, db);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients.length = 0;
    await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
  });

  describe('socket auth handshake', () => {
    it('rejects the connection when there is no session cookie', async () => {
      const socket = connect();
      const err = await once<Error>(socket, 'connect_error');
      expect(err.message).toContain('unauthorized');
    });

    it('rejects the connection when the session token is unknown', async () => {
      const socket = connect('deadbeef');
      const err = await once<Error>(socket, 'connect_error');
      expect(err.message).toContain('unauthorized');
    });
  });

  describe('presence', () => {
    it('broadcasts board:presence with {boardId, users:[{id,name,avatarColor}]} on join', async () => {
      const uid = mkUser({ name: 'Alice', avatarColor: 'teal' });
      const boardId = mkBoard('team', uid);
      const socket = connect(createSession(db, uid));
      await once(socket, 'connect');
      const presence = await new Promise<{ boardId: string; users: Array<{ id: string; name: string; avatarColor: string }> }>((resolve) => {
        socket.once('board:presence', resolve);
        socket.emit('board:join', { boardId });
      });
      expect(presence.boardId).toBe(boardId);
      expect(presence.users).toEqual([{ id: uid, name: 'Alice', avatarColor: 'teal' }]);
    });
  });

  describe('board:join access check', () => {
    it('lets a private-board member into the room but denies a non-member', async () => {
      const owner = mkUser({ name: 'Owner' });
      const stranger = mkUser({ name: 'Stranger' });
      const boardId = mkBoard('private', owner);
      db.insert(schema.boardMembers).values({ boardId, userId: owner, starred: false }).run();

      const memberSock = connect(createSession(db, owner));
      const strangerSock = connect(createSession(db, stranger));
      await Promise.all([once(memberSock, 'connect'), once(strangerSock, 'connect')]);

      memberSock.emit('board:join', { boardId });
      strangerSock.emit('board:join', { boardId });
      await new Promise((resolve) => setTimeout(resolve, 150));

      const memberGot = receivedWithin(memberSock, 'board:changed', 300);
      const strangerGot = receivedWithin(strangerSock, 'board:changed', 300);
      realtime.emitBoardChanged(boardId, owner);

      expect(await memberGot).toBe(true);
      expect(await strangerGot).toBe(false);
    });
  });
  ```

- [ ] **Step 3: Run the test — expect failure.**
  ```bash
  npm test -w server -- realtime
  ```
  Expected: fails to resolve `../src/realtime` — "Failed to resolve import".

- [ ] **Step 4: Create** `server/src/realtime.ts` (full file).
  ```ts
  import { Server } from 'socket.io';
  import type { Server as HttpServer } from 'node:http';
  import { and, eq, gt, inArray } from 'drizzle-orm';
  import * as schema from './db/schema';
  import { canAccessBoard, SESSION_COOKIE } from './lib/perms';
  import type { Db } from './db/index';
  import type { BoardChangedEvent, PresenceEvent } from '@shared/types';

  interface SocketData {
    userId: string;
  }

  function parseCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return undefined;
  }

  const roomOf = (boardId: string): string => `board:${boardId}`;

  export function setupRealtime(server: HttpServer, db: Db) {
    const io = new Server(server, { serveClient: false });

    io.use((socket, next) => {
      const token = parseCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
      if (!token) return next(new Error('unauthorized'));
      const now = new Date().toISOString();
      const session = db
        .select()
        .from(schema.sessions)
        .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, now)))
        .get();
      if (!session) return next(new Error('unauthorized'));
      const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
      if (!user || user.deactivatedAt !== null) return next(new Error('unauthorized'));
      (socket.data as SocketData).userId = user.id;
      next();
    });

    async function broadcastPresence(boardId: string): Promise<void> {
      const room = roomOf(boardId);
      const sockets = await io.in(room).fetchSockets();
      const userIds = [...new Set(sockets.map((s) => (s.data as SocketData).userId))];
      const users = userIds.length
        ? db
            .select({ id: schema.users.id, name: schema.users.name, avatarColor: schema.users.avatarColor })
            .from(schema.users)
            .where(inArray(schema.users.id, userIds))
            .all()
        : [];
      const payload: PresenceEvent = { boardId, users };
      io.to(room).emit('board:presence', payload);
    }

    io.on('connection', (socket) => {
      const userId = (socket.data as SocketData).userId;

      socket.on('board:join', async (arg: { boardId?: unknown }) => {
        const boardId = arg?.boardId;
        if (typeof boardId !== 'string') return;
        if (!canAccessBoard(db, userId, boardId)) return;
        await socket.join(roomOf(boardId));
        await broadcastPresence(boardId);
      });

      socket.on('board:leave', async (arg: { boardId?: unknown }) => {
        const boardId = arg?.boardId;
        if (typeof boardId !== 'string') return;
        await socket.leave(roomOf(boardId));
        await broadcastPresence(boardId);
      });

      socket.on('disconnecting', () => {
        const boardIds = [...socket.rooms]
          .filter((r) => r.startsWith('board:'))
          .map((r) => r.slice('board:'.length));
        setImmediate(() => {
          for (const boardId of boardIds) void broadcastPresence(boardId);
        });
      });
    });

    function emitBoardChanged(boardId: string, byUserId: string): void {
      const payload: BoardChangedEvent = { boardId, byUserId };
      io.to(roomOf(boardId)).emit('board:changed', payload);
    }

    return { io, emitBoardChanged };
  }
  ```

- [ ] **Step 5: Run the test — expect pass.**
  ```bash
  npm test -w server -- realtime
  ```
  Expected: `Test Files 1 passed`, `Tests 4 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add server/package.json server/package-lock.json server/src/realtime.ts server/test/realtime.test.ts && git commit -m "$(cat <<'EOF'
  feat: socket.io realtime — cookie-auth handshake, board rooms, presence

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```
  (If the lockfile lives at repo root, use `package-lock.json` instead of `server/package-lock.json`.)

---

### Task 7.2: jobs.ts — dueSoon reminders (recipient rules + dedupe, injectable clock)

Files: `server/src/jobs.ts`, `server/test/jobs-duesoon.test.ts`

Rule: at 09:00 server time a card is "due soon" when its `dueDate` (date-only, local calendar) equals today's or tomorrow's date. Recipients are the card's assignees; if it has none, its creator. One reminder per card per user: skip if a `due_soon` notification for that `(userId, cardId)` already exists.

- [ ] **Step 1: Write the failing test** `server/test/jobs-duesoon.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { nanoid } from 'nanoid';
  import { and, eq } from 'drizzle-orm';
  import { createDb } from '../src/db/index';
  import * as schema from '../src/db/schema';
  import { runDueSoon } from '../src/jobs';

  type Db = ReturnType<typeof createDb>['db'];

  // July 14 2026, 09:00 local time. Constructed from components so it is TZ-stable.
  const NOW = new Date(2026, 6, 14, 9, 0, 0);
  const TODAY = '2026-07-14';
  const TOMORROW = '2026-07-15';
  const LATER = '2026-07-20';

  let db: Db;
  beforeEach(() => {
    db = createDb(':memory:').db;
  });

  function mkUser(): string {
    const id = nanoid(12);
    db.insert(schema.users).values({
      id,
      email: `${id}@x.com`,
      name: 'U',
      passwordHash: 'x',
      avatarColor: 'coral',
      isAdmin: false,
      emailNotifications: true,
      deactivatedAt: null,
      createdAt: new Date().toISOString(),
    }).run();
    return id;
  }

  function mkCard(dueDate: string | null, createdBy: string): string {
    const boardId = nanoid(12);
    db.insert(schema.boards).values({
      id: boardId, name: 'B', accentColor: 'coral', visibility: 'team',
      createdBy, archivedAt: null, createdAt: new Date().toISOString(),
    }).run();
    const listId = nanoid(12);
    db.insert(schema.lists).values({ id: listId, boardId, name: 'L', position: 'a0', archivedAt: null }).run();
    const cardId = nanoid(12);
    const iso = new Date().toISOString();
    db.insert(schema.cards).values({
      id: cardId, listId, boardId, title: 'C', description: '', dueDate,
      position: 'a0', archivedAt: null, createdBy, createdAt: iso, updatedAt: iso,
    }).run();
    return cardId;
  }

  function dueSoonCount(userId: string, cardId: string): number {
    return db
      .select()
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.cardId, cardId),
        eq(schema.notifications.type, 'due_soon'),
      ))
      .all().length;
  }

  describe('runDueSoon', () => {
    it('notifies every assignee of a card due tomorrow', () => {
      const owner = mkUser();
      const a1 = mkUser();
      const a2 = mkUser();
      const cardId = mkCard(TOMORROW, owner);
      db.insert(schema.cardAssignees).values({ cardId, userId: a1 }).run();
      db.insert(schema.cardAssignees).values({ cardId, userId: a2 }).run();

      runDueSoon(db, NOW);

      expect(dueSoonCount(a1, cardId)).toBe(1);
      expect(dueSoonCount(a2, cardId)).toBe(1);
      expect(dueSoonCount(owner, cardId)).toBe(0);
    });

    it('notifies the creator when a card due today has no assignees', () => {
      const owner = mkUser();
      const cardId = mkCard(TODAY, owner);
      runDueSoon(db, NOW);
      expect(dueSoonCount(owner, cardId)).toBe(1);
    });

    it('ignores cards outside the 24h window and cards without a due date', () => {
      const owner = mkUser();
      const far = mkCard(LATER, owner);
      const none = mkCard(null, owner);
      runDueSoon(db, NOW);
      expect(dueSoonCount(owner, far)).toBe(0);
      expect(dueSoonCount(owner, none)).toBe(0);
    });

    it('ignores archived cards', () => {
      const owner = mkUser();
      const cardId = mkCard(TOMORROW, owner);
      db.update(schema.cards).set({ archivedAt: new Date().toISOString() }).where(eq(schema.cards.id, cardId)).run();
      runDueSoon(db, NOW);
      expect(dueSoonCount(owner, cardId)).toBe(0);
    });

    it('is deduped: a second run does not create a second reminder per user', () => {
      const owner = mkUser();
      const a1 = mkUser();
      const cardId = mkCard(TOMORROW, owner);
      db.insert(schema.cardAssignees).values({ cardId, userId: a1 }).run();
      runDueSoon(db, NOW);
      runDueSoon(db, NOW);
      expect(dueSoonCount(a1, cardId)).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- jobs-duesoon
  ```
  Expected: fails to resolve `../src/jobs` — "Failed to resolve import".

- [ ] **Step 3: Create** `server/src/jobs.ts` with the dueSoon logic (Task 7.3 extends this file with the backup + scheduler).
  ```ts
  import { and, eq, isNull, inArray } from 'drizzle-orm';
  import type { Db } from './db/index';
  import { cards, cardAssignees, notifications } from './db/schema';
  import { notify } from './lib/notify';

  function toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  export function runDueSoon(db: Db, now: Date = new Date()): void {
    const todayStr = toDateStr(now);
    const tomorrowStr = toDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const due = db
      .select()
      .from(cards)
      .where(and(isNull(cards.archivedAt), inArray(cards.dueDate, [todayStr, tomorrowStr])))
      .all();

    for (const card of due) {
      const assignees = db
        .select({ userId: cardAssignees.userId })
        .from(cardAssignees)
        .where(eq(cardAssignees.cardId, card.id))
        .all()
        .map((a) => a.userId);
      const recipients = assignees.length ? assignees : [card.createdBy];
      for (const userId of recipients) {
        const already = db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(
            eq(notifications.userId, userId),
            eq(notifications.cardId, card.id),
            eq(notifications.type, 'due_soon'),
          ))
          .get();
        if (already) continue;
        notify(db, { userId, type: 'due_soon', cardId: card.id, actorId: null });
      }
    }
  }
  ```

- [ ] **Step 4: Run the test — expect pass.**
  ```bash
  npm test -w server -- jobs-duesoon
  ```
  Expected: `Test Files 1 passed`, `Tests 5 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add server/src/jobs.ts server/test/jobs-duesoon.test.ts && git commit -m "$(cat <<'EOF'
  feat: dueSoon reminder job — assignees-else-creator with per-card/user dedupe

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7.3: jobs.ts — nightly SQLite backup (keep 14, optional S3) + startJobs

Files: `server/package.json`, `server/src/jobs.ts`, `server/test/jobs-backup.test.ts`

`runBackup` uses the SQLite online backup API (`sqlite.backup(dest)`) to copy the live db into `DATA_DIR/backups/app-<timestamp>.db`, prunes to the newest 14, and — only when all four `BACKUP_S3_*` env vars are set — PUTs the file to an S3-compatible bucket via `aws4fetch`. `startJobs` schedules `runDueSoon` daily at 09:00 and `runBackup` nightly at 03:00 (server local time).

- [ ] **Step 1: Install the S3 signer.**
  ```bash
  npm install -w server aws4fetch@^1
  ```
  Expected: `server/package.json` gains `aws4fetch` under `dependencies`; install completes with no errors.

- [ ] **Step 2: Write the failing test** `server/test/jobs-backup.test.ts`.
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { promises as fs } from 'node:fs';
  import path from 'node:path';
  import os from 'node:os';
  import { createDb } from '../src/db/index';
  import { runBackup } from '../src/jobs';

  let sqlite: ReturnType<typeof createDb>['sqlite'];
  let dir: string;

  beforeEach(async () => {
    sqlite = createDb(':memory:').sqlite;
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-backup-'));
  });

  describe('runBackup', () => {
    it('writes a non-empty .db file under <dataDir>/backups and returns its path', async () => {
      const dest = await runBackup(sqlite, dir, new Date(2026, 6, 14, 3, 0, 0));
      expect(dest.startsWith(path.join(dir, 'backups'))).toBe(true);
      expect(dest.endsWith('.db')).toBe(true);
      const stat = await fs.stat(dest);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('prunes to keep only the newest 14 backups', async () => {
      for (let i = 0; i < 16; i++) {
        await runBackup(sqlite, dir, new Date(2026, 0, 1, 3, 0, 0, i));
      }
      const files = (await fs.readdir(path.join(dir, 'backups'))).filter((f) => f.endsWith('.db'));
      expect(files).toHaveLength(14);
    });
  });
  ```

- [ ] **Step 3: Run the test — expect failure.**
  ```bash
  npm test -w server -- jobs-backup
  ```
  Expected: fails — `runBackup` is not exported from `../src/jobs` yet (`runBackup is not a function` / import has no such export), `Tests 2 failed`.

- [ ] **Step 4: Add the filesystem imports to** `server/src/jobs.ts`. Replace the first import line:
  ```ts
  import { and, eq, isNull, inArray } from 'drizzle-orm';
  ```
  with:
  ```ts
  import path from 'node:path';
  import { promises as fs } from 'node:fs';
  import { and, eq, isNull, inArray } from 'drizzle-orm';
  ```

- [ ] **Step 5: Append the backup + scheduler code to** `server/src/jobs.ts`. After the closing brace of `runDueSoon` (the file's current last line, `}`), append:
  ```ts

  type SqliteBackup = { backup(destination: string): Promise<unknown> };

  async function maybeUploadToS3(filePath: string, key: string): Promise<void> {
    const endpoint = process.env.BACKUP_S3_ENDPOINT;
    const bucket = process.env.BACKUP_S3_BUCKET;
    const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY;
    const secretAccessKey = process.env.BACKUP_S3_SECRET_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return;
    try {
      const { AwsClient } = await import('aws4fetch');
      const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3' });
      const body = await fs.readFile(filePath);
      const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
      const res = await client.fetch(url, { method: 'PUT', body });
      if (!res.ok) console.error(`[backup] S3 upload failed: ${res.status}`);
    } catch (err) {
      console.error('[backup] S3 upload error', err);
    }
  }

  export async function runBackup(sqlite: SqliteBackup, dataDir: string, now: Date = new Date()): Promise<string> {
    const backupsDir = path.join(dataDir, 'backups');
    await fs.mkdir(backupsDir, { recursive: true });
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const dest = path.join(backupsDir, `app-${stamp}.db`);
    await sqlite.backup(dest);

    const files = (await fs.readdir(backupsDir))
      .filter((f) => f.startsWith('app-') && f.endsWith('.db'))
      .sort();
    const excess = files.length - 14;
    for (let i = 0; i < excess; i++) {
      await fs.rm(path.join(backupsDir, files[i]), { force: true });
    }

    await maybeUploadToS3(dest, path.basename(dest));
    return dest;
  }

  function msUntilNext(now: Date, hour: number, minute: number): number {
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function scheduleDaily(hour: number, minute: number, run: () => void): void {
    const arm = (): void => {
      setTimeout(() => {
        try {
          run();
        } catch (err) {
          console.error('[jobs] scheduled run failed', err);
        }
        arm();
      }, msUntilNext(new Date(), hour, minute)).unref();
    };
    arm();
  }

  export function startJobs(deps: { db: Db; sqlite: SqliteBackup; dataDir: string }): void {
    scheduleDaily(9, 0, () => runDueSoon(deps.db));
    scheduleDaily(3, 0, () => {
      void runBackup(deps.sqlite, deps.dataDir);
    });
  }
  ```

- [ ] **Step 6: Run the test — expect pass.**
  ```bash
  npm test -w server -- jobs-backup
  ```
  Expected: `Test Files 1 passed`, `Tests 2 passed`.

- [ ] **Step 7: Commit.**
  ```bash
  git add server/package.json server/package-lock.json server/src/jobs.ts server/test/jobs-backup.test.ts && git commit -m "$(cat <<'EOF'
  feat: nightly SQLite backup (keep 14, optional S3) and daily/nightly scheduler

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```
  (If the lockfile lives at repo root, use `package-lock.json` instead of `server/package-lock.json`.)

---

### Task 7.4: Wire realtime + jobs into index.ts

Files: `server/src/index.ts`

This is thin production wiring (no unit test — the pieces are covered by Tasks 7.1–7.3). `emitBoardChanged` is set after `setupRealtime`, so `buildApp` receives an `emit` that forwards through a mutable reference (resolving the chicken-and-egg between `buildApp` needing `emit` and `setupRealtime` needing the app's server).

- [ ] **Step 1: Overwrite** `server/src/index.ts` (full file).
  ```ts
  import { mkdirSync } from 'node:fs';
  import { createDb } from './db/index';
  import { firstRunBootstrap } from './bootstrap';
  import { buildApp } from './app';
  import { setupRealtime } from './realtime';
  import { startJobs } from './jobs';

  const dataDir = process.env.DATA_DIR ?? './data';
  mkdirSync(dataDir, { recursive: true });

  const { db, sqlite } = createDb(`${dataDir}/app.db`);
  firstRunBootstrap(db);

  let emitBoardChanged: (boardId: string, byUserId: string) => void = () => {};
  const app = buildApp({ db, dataDir, emit: { boardChanged: (b, u) => emitBoardChanged(b, u) } });

  const realtime = setupRealtime(app.server, db);
  emitBoardChanged = realtime.emitBoardChanged;

  startJobs({ db, sqlite, dataDir });

  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
  ```
  Note: `app.server` is the underlying `http.Server`, available synchronously after `buildApp` and before `app.listen`; Socket.IO attaches to it and handles WebSocket upgrades on the same port.

- [ ] **Step 2: Type-check the whole server workspace.**
  ```bash
  npm run build -w server
  ```
  Expected: `tsc` exits 0 with no type errors (compiles `realtime.ts`, `jobs.ts`, and the new `index.ts`).

- [ ] **Step 3: Commit.**
  ```bash
  git add server/src/index.ts && git commit -m "$(cat <<'EOF'
  feat: wire socket.io realtime and scheduled jobs into server entrypoint

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7.5: routes/admin.ts — invites (existing user → password reset instead)

Files: `server/src/routes/admin.ts`, `server/src/app.ts`, `server/test/admin-invites.test.ts`

`POST /api/admin/invites` (admin only): for a brand-new email, invalidate any prior unused invites for it and create a fresh 7-day invite (`/invite/:token`); for an email that already belongs to a user, issue a 1-hour password reset (`/reset/:token`) instead of a duplicate account. Both return `{ link }` and best-effort email the link.

This task creates `admin.ts` with its full import block and all four request schemas up front; only the invites handler is implemented now (Tasks 7.6, 7.7, and 7.8 fill in the remaining handlers via edits). Some imports/schemas are unused until then — harmless, because no server build runs between Tasks 7.5 and 7.8 and Vitest does not type-check.

- [ ] **Step 1: Write the failing test** `server/test/admin-invites.test.ts`.
  ```ts
  import { describe, it, expect } from 'vitest';
  import { and, eq, isNull } from 'drizzle-orm';
  import { makeApp, seedUser, login } from './helpers';
  import { invites, passwordResets } from '../src/db/schema';

  async function setup() {
    const { app, db } = makeApp();
    const admin = seedUser(db, { email: 'admin@x.com', name: 'Admin', password: 'password123', isAdmin: true });
    const cookie = await login(app, 'admin@x.com', 'password123');
    return { app, db, admin, cookie };
  }

  describe('POST /api/admin/invites', () => {
    it('creates an invite link for a brand-new email', async () => {
      const { app, db, cookie } = await setup();
      const res = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie }, payload: { email: 'new@x.com' } });
      expect(res.statusCode).toBe(200);
      expect(res.json().link).toContain('/invite/');
      const row = db.select().from(invites).where(eq(invites.email, 'new@x.com')).get();
      expect(row).toBeDefined();
      expect(row!.usedAt).toBeNull();
    });

    it('normalizes the email to lowercase', async () => {
      const { app, db, cookie } = await setup();
      await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie }, payload: { email: 'MixedCase@X.com' } });
      expect(db.select().from(invites).where(eq(invites.email, 'mixedcase@x.com')).get()).toBeDefined();
    });

    it('invalidates prior unused invites for the same email', async () => {
      const { app, db, cookie } = await setup();
      const first = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie }, payload: { email: 'again@x.com' } });
      const firstToken = first.json().link.split('/invite/')[1];
      await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie }, payload: { email: 'again@x.com' } });
      expect(db.select().from(invites).where(eq(invites.id, firstToken)).get()!.usedAt).not.toBeNull();
      expect(db.select().from(invites).where(and(eq(invites.email, 'again@x.com'), isNull(invites.usedAt))).all()).toHaveLength(1);
    });

    it('issues a password-reset link when the email already belongs to a user', async () => {
      const { app, db, cookie } = await setup();
      const bob = seedUser(db, { email: 'bob@x.com', name: 'Bob', password: 'password123' });
      const res = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie }, payload: { email: 'bob@x.com' } });
      expect(res.statusCode).toBe(200);
      expect(res.json().link).toContain('/reset/');
      expect(db.select().from(passwordResets).where(eq(passwordResets.userId, bob.id)).get()).toBeDefined();
      expect(db.select().from(invites).where(eq(invites.email, 'bob@x.com')).get()).toBeUndefined();
    });

    it('rejects a non-admin with 403', async () => {
      const { app, db } = await setup();
      seedUser(db, { email: 'reg@x.com', name: 'Reg', password: 'password123' });
      const regCookie = await login(app, 'reg@x.com', 'password123');
      const res = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie: regCookie }, payload: { email: 'z@x.com' } });
      expect(res.statusCode).toBe(403);
    });

    it('rejects an invalid email with 400', async () => {
      const { app, cookie } = await setup();
      const res = await app.inject({ method: 'POST', url: '/api/admin/invites', headers: { cookie }, payload: { email: 'not-an-email' } });
      expect(res.statusCode).toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- admin-invites
  ```
  Expected: fails — route not registered, `POST /api/admin/invites` returns 404, `Tests 6 failed`.

- [ ] **Step 3: Create** `server/src/routes/admin.ts` (full import block + schemas + invites handler).
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { z } from 'zod';
  import { and, eq, isNull, isNotNull, inArray, sql } from 'drizzle-orm';
  import { randomBytes } from 'node:crypto';
  import path from 'node:path';
  import { promises as fs } from 'node:fs';
  import { requireAuth, requireAdmin, revokeUserSessions, toUserPublic } from '../lib/perms';
  import { sendEmail } from '../lib/email';
  import type { Db } from '../db/index';
  import type { AppDeps } from '../app';
  import type { BoardSummary, LabelColor } from '@shared/types';
  import {
    users, invites, passwordResets, boards, boardMembers, lists, cards,
    cardAssignees, labels, cardLabels, checklistItems, comments, attachments, activity, notifications,
  } from '../db/schema';

  const inviteSchema = z.object({ email: z.string().email() });
  const patchMemberSchema = z.object({ deactivated: z.boolean().optional(), isAdmin: z.boolean().optional() });
  const purgeSchema = z.object({ entity: z.enum(['board', 'list', 'card']), id: z.string().min(1) });
  const restoreSchema = z.object({ entity: z.literal('board'), id: z.string().min(1) });

  function newToken(): string {
    return randomBytes(24).toString('hex');
  }

  function appUrl(): string {
    return (process.env.APP_URL ?? '').replace(/\/$/, '');
  }

  export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps): void {
    const { db } = deps;

    app.post('/api/admin/invites', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid email' });
      const email = parsed.data.email.toLowerCase();
      const now = new Date().toISOString();

      const existing = db.select().from(users).where(eq(users.email, email)).get();
      if (existing) {
        const token = newToken();
        db.insert(passwordResets).values({
          id: token,
          userId: existing.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          usedAt: null,
        }).run();
        const link = `${appUrl()}/reset/${token}`;
        void sendEmail({ to: email, subject: 'Reset your password', html: `<p><a href="${link}">Set a new password</a></p>` });
        return reply.send({ link });
      }

      db.update(invites).set({ usedAt: now }).where(and(eq(invites.email, email), isNull(invites.usedAt))).run();
      const token = newToken();
      db.insert(invites).values({
        id: token,
        email,
        invitedBy: req.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null,
      }).run();
      const link = `${appUrl()}/invite/${token}`;
      void sendEmail({ to: email, subject: 'You are invited', html: `<p><a href="${link}">Accept your invitation</a></p>` });
      return reply.send({ link });
    });
  }
  ```

- [ ] **Step 4: Register the admin routes in** `server/src/app.ts`. Add the import beside the other route imports:
  ```ts
  import { registerAdminRoutes } from './routes/admin';
  ```
  And add the registration beside the other `registerXRoutes(app, ctx)` calls inside `buildApp`. Pass the existing `ctx` (the `RouteCtx` Section 4 builds), matching Sections 4–6 — `registerAdminRoutes` destructures what it needs from it:
  ```ts
  registerAdminRoutes(app, ctx);
  ```

- [ ] **Step 5: Run the test — expect pass.**
  ```bash
  npm test -w server -- admin-invites
  ```
  Expected: `Test Files 1 passed`, `Tests 6 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add server/src/routes/admin.ts server/src/app.ts server/test/admin-invites.test.ts && git commit -m "$(cat <<'EOF'
  feat(admin): invites route — existing account issues a password reset instead

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7.6: routes/admin.ts — members list + disk usage, deactivate/promote, reset-password

Files: `server/src/routes/admin.ts`, `server/test/admin-members.test.ts`

Adds three handlers: `GET /api/admin/members` → `{ members, diskUsageBytes, emailConfigured }`; `PATCH /api/admin/members/:id` (deactivate revokes sessions; also promote/demote; an admin cannot deactivate themselves); `POST /api/admin/members/:id/reset-password` → `{ link }` and revokes that user's sessions.

- [ ] **Step 1: Write the failing test** `server/test/admin-members.test.ts`.
  ```ts
  import { describe, it, expect } from 'vitest';
  import { eq } from 'drizzle-orm';
  import { nanoid } from 'nanoid';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';
  import { attachments, passwordResets } from '../src/db/schema';

  async function setup() {
    const { app, db } = makeApp();
    const admin = seedUser(db, { email: 'admin@x.com', name: 'Admin', password: 'password123', isAdmin: true });
    const adminCookie = await login(app, 'admin@x.com', 'password123');
    const bob = seedUser(db, { email: 'bob@x.com', name: 'Bob', password: 'password123' });
    return { app, db, admin, bob, adminCookie };
  }

  describe('GET /api/admin/members', () => {
    it('lists members with the total attachment disk usage', async () => {
      const { app, db, admin, adminCookie } = await setup();
      const { listId } = await createBoard(app, adminCookie);
      const cardId = await createCard(app, adminCookie, listId);
      const iso = new Date().toISOString();
      db.insert(attachments).values({ id: nanoid(12), cardId, filename: 'a.bin', storedName: 's1', sizeBytes: 150, mime: 'application/octet-stream', uploadedBy: admin.id, createdAt: iso }).run();
      db.insert(attachments).values({ id: nanoid(12), cardId, filename: 'b.bin', storedName: 's2', sizeBytes: 250, mime: 'application/octet-stream', uploadedBy: admin.id, createdAt: iso }).run();

      const res = await app.inject({ method: 'GET', url: '/api/admin/members', headers: { cookie: adminCookie } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.members).toHaveLength(2);
      expect(body.diskUsageBytes).toBe(400);
      expect(body.emailConfigured).toBe(false);
    });

    it('reports zero disk usage when there are no attachments', async () => {
      const { app, adminCookie } = await setup();
      const res = await app.inject({ method: 'GET', url: '/api/admin/members', headers: { cookie: adminCookie } });
      expect(res.json().diskUsageBytes).toBe(0);
    });

    it('forbids a non-admin', async () => {
      const { app } = await setup();
      const bobCookie = await login(app, 'bob@x.com', 'password123');
      const res = await app.inject({ method: 'GET', url: '/api/admin/members', headers: { cookie: bobCookie } });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/admin/members/:id', () => {
    it('deactivates a member and revokes their sessions', async () => {
      const { app, bob, adminCookie } = await setup();
      const bobCookie = await login(app, 'bob@x.com', 'password123');
      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: bobCookie } })).statusCode).toBe(200);

      const res = await app.inject({ method: 'PATCH', url: `/api/admin/members/${bob.id}`, headers: { cookie: adminCookie }, payload: { deactivated: true } });
      expect(res.statusCode).toBe(200);
      expect(res.json().deactivated).toBe(true);

      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: bobCookie } })).statusCode).toBe(401);
      const relogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'bob@x.com', password: 'password123' } });
      expect(relogin.statusCode).toBe(401);
    });

    it('promotes a member to admin', async () => {
      const { app, bob, adminCookie } = await setup();
      const res = await app.inject({ method: 'PATCH', url: `/api/admin/members/${bob.id}`, headers: { cookie: adminCookie }, payload: { isAdmin: true } });
      expect(res.json().isAdmin).toBe(true);
    });

    it('prevents an admin from deactivating themselves', async () => {
      const { app, admin, adminCookie } = await setup();
      const res = await app.inject({ method: 'PATCH', url: `/api/admin/members/${admin.id}`, headers: { cookie: adminCookie }, payload: { deactivated: true } });
      expect(res.statusCode).toBe(400);
    });

    it('404s for an unknown member', async () => {
      const { app, adminCookie } = await setup();
      const res = await app.inject({ method: 'PATCH', url: '/api/admin/members/nope00000000', headers: { cookie: adminCookie }, payload: { isAdmin: true } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/admin/members/:id/reset-password', () => {
    it('issues a reset link and revokes the member sessions', async () => {
      const { app, db, bob, adminCookie } = await setup();
      const bobCookie = await login(app, 'bob@x.com', 'password123');
      const res = await app.inject({ method: 'POST', url: `/api/admin/members/${bob.id}/reset-password`, headers: { cookie: adminCookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json().link).toContain('/reset/');
      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: bobCookie } })).statusCode).toBe(401);
      expect(db.select().from(passwordResets).where(eq(passwordResets.userId, bob.id)).get()).toBeDefined();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- admin-members
  ```
  Expected: fails — these routes are not registered yet, requests return 404, `Tests 8 failed`.

- [ ] **Step 3: Add the three handlers to** `server/src/routes/admin.ts`. Replace the end of `registerAdminRoutes` (the invites handler's close and the function's closing brace):
  ```ts
    return reply.send({ link });
  });
}
  ```
  with:
  ```ts
    return reply.send({ link });
  });

  app.get('/api/admin/members', { preHandler: [requireAuth, requireAdmin] }, async (_req, reply) => {
    const members = db.select().from(users).all().map(toUserPublic);
    const usage = db.select({ total: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)` }).from(attachments).get();
    const emailConfigured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    return reply.send({ members, diskUsageBytes: usage?.total ?? 0, emailConfigured });
  });

  app.patch('/api/admin/members/:id', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = patchMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const target = db.select().from(users).where(eq(users.id, id)).get();
    if (!target) return reply.code(404).send({ error: 'Member not found' });
    if (id === req.user.id && parsed.data.deactivated === true) {
      return reply.code(400).send({ error: 'You cannot deactivate yourself' });
    }
    const updates: Partial<{ deactivatedAt: string | null; isAdmin: boolean }> = {};
    if (parsed.data.deactivated !== undefined) updates.deactivatedAt = parsed.data.deactivated ? new Date().toISOString() : null;
    if (parsed.data.isAdmin !== undefined) updates.isAdmin = parsed.data.isAdmin;
    if (Object.keys(updates).length) db.update(users).set(updates).where(eq(users.id, id)).run();
    if (parsed.data.deactivated === true) revokeUserSessions(db, id);
    const updated = db.select().from(users).where(eq(users.id, id)).get()!;
    return reply.send(toUserPublic(updated));
  });

  app.post('/api/admin/members/:id/reset-password', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const target = db.select().from(users).where(eq(users.id, id)).get();
    if (!target) return reply.code(404).send({ error: 'Member not found' });
    const token = newToken();
    db.insert(passwordResets).values({
      id: token,
      userId: id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      usedAt: null,
    }).run();
    revokeUserSessions(db, id);
    const link = `${appUrl()}/reset/${token}`;
    void sendEmail({ to: target.email, subject: 'Password reset', html: `<p><a href="${link}">Set a new password</a></p>` });
    return reply.send({ link });
  });
}
  ```

- [ ] **Step 4: Run the test — expect pass.**
  ```bash
  npm test -w server -- admin-members
  ```
  Expected: `Test Files 1 passed`, `Tests 8 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add server/src/routes/admin.ts server/test/admin-members.test.ts && git commit -m "$(cat <<'EOF'
  feat(admin): members list + disk usage, deactivate/promote, reset-password

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7.7: routes/admin.ts — purge archived items (cascade attachment files)

Files: `server/src/routes/admin.ts`, `server/test/admin-purge.test.ts`

`POST /api/admin/purge {entity, id}` permanently deletes an archived board/list/card and every related row, removing each attachment's file from disk. Only archived items purge (400 otherwise).

- [ ] **Step 1: Write the failing test** `server/test/admin-purge.test.ts`.
  ```ts
  import { describe, it, expect } from 'vitest';
  import { eq } from 'drizzle-orm';
  import path from 'node:path';
  import { existsSync } from 'node:fs';
  import type { FastifyInstance } from 'fastify';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard, createCard } from './collab-helpers';
  import { attachments, cards, boards } from '../src/db/schema';

  const BOUNDARY = '----vitestboundary';
  function multipart(filename: string, content: Buffer, contentType = 'text/plain'): Buffer {
    const head = Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
    return Buffer.concat([head, content, tail]);
  }
  const mpHeaders = (cookie: string) => ({ cookie, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` });
  const UPLOADS = path.join('/tmp/company-trello-test', 'uploads');

  async function setup() {
    const { app, db } = makeApp();
    seedUser(db, { email: 'admin@x.com', name: 'Admin', password: 'password123', isAdmin: true });
    const adminCookie = await login(app, 'admin@x.com', 'password123');
    return { app, db, adminCookie };
  }

  async function uploadTo(app: FastifyInstance, cookie: string, cardId: string): Promise<{ id: string }> {
    const up = await app.inject({ method: 'POST', url: `/api/cards/${cardId}/attachments`, headers: mpHeaders(cookie), payload: multipart('f.txt', Buffer.from('data')) });
    return { id: up.json().id };
  }

  describe('POST /api/admin/purge', () => {
    it('purges an archived card and deletes its attachment files', async () => {
      const { app, db, adminCookie } = await setup();
      const { listId } = await createBoard(app, adminCookie);
      const cardId = await createCard(app, adminCookie, listId);
      const att = await uploadTo(app, adminCookie, cardId);
      const storedName = db.select().from(attachments).where(eq(attachments.id, att.id)).get()!.storedName;
      const filePath = path.join(UPLOADS, storedName);
      expect(existsSync(filePath)).toBe(true);

      await app.inject({ method: 'DELETE', url: `/api/cards/${cardId}`, headers: { cookie: adminCookie } });
      const res = await app.inject({ method: 'POST', url: '/api/admin/purge', headers: { cookie: adminCookie }, payload: { entity: 'card', id: cardId } });
      expect(res.statusCode).toBe(204);
      expect(db.select().from(cards).where(eq(cards.id, cardId)).get()).toBeUndefined();
      expect(db.select().from(attachments).where(eq(attachments.id, att.id)).get()).toBeUndefined();
      expect(existsSync(filePath)).toBe(false);
    });

    it('refuses to purge a card that is not archived', async () => {
      const { app, adminCookie } = await setup();
      const { listId } = await createBoard(app, adminCookie);
      const cardId = await createCard(app, adminCookie, listId);
      const res = await app.inject({ method: 'POST', url: '/api/admin/purge', headers: { cookie: adminCookie }, payload: { entity: 'card', id: cardId } });
      expect(res.statusCode).toBe(400);
    });

    it('purges an archived board and cascades its attachment files', async () => {
      const { app, db, adminCookie } = await setup();
      const { boardId, listId } = await createBoard(app, adminCookie);
      const cardId = await createCard(app, adminCookie, listId);
      const att = await uploadTo(app, adminCookie, cardId);
      const storedName = db.select().from(attachments).where(eq(attachments.id, att.id)).get()!.storedName;
      const filePath = path.join(UPLOADS, storedName);

      await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie: adminCookie } });
      const res = await app.inject({ method: 'POST', url: '/api/admin/purge', headers: { cookie: adminCookie }, payload: { entity: 'board', id: boardId } });
      expect(res.statusCode).toBe(204);
      expect(db.select().from(boards).where(eq(boards.id, boardId)).get()).toBeUndefined();
      expect(existsSync(filePath)).toBe(false);
    });

    it('forbids a non-admin', async () => {
      const { app, db, adminCookie } = await setup();
      seedUser(db, { email: 'r@x.com', name: 'R', password: 'password123' });
      const regCookie = await login(app, 'r@x.com', 'password123');
      const res = await app.inject({ method: 'POST', url: '/api/admin/purge', headers: { cookie: regCookie }, payload: { entity: 'card', id: 'x' } });
      expect(res.statusCode).toBe(403);
    });
  });
  ```
  Note: `uploadTo` returns only the attachment `id`; the test reads `storedName` from the db (uploads are written under `<dataDir>/uploads/<storedName>`).

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- admin-purge
  ```
  Expected: fails — `POST /api/admin/purge` is not registered, returns 404, `Tests 4 failed`.

- [ ] **Step 3: Add the `purgeCards` cascade helper to** `server/src/routes/admin.ts`. Replace this line:
  ```ts
  export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps): void {
  ```
  with:
  ```ts
  async function purgeCards(db: Db, dataDir: string, cardIds: string[]): Promise<void> {
    if (!cardIds.length) return;
    const atts = db.select().from(attachments).where(inArray(attachments.cardId, cardIds)).all();
    for (const a of atts) {
      await fs.rm(path.join(dataDir, 'uploads', a.storedName), { force: true });
    }
    db.delete(attachments).where(inArray(attachments.cardId, cardIds)).run();
    db.delete(cardAssignees).where(inArray(cardAssignees.cardId, cardIds)).run();
    db.delete(cardLabels).where(inArray(cardLabels.cardId, cardIds)).run();
    db.delete(checklistItems).where(inArray(checklistItems.cardId, cardIds)).run();
    db.delete(comments).where(inArray(comments.cardId, cardIds)).run();
    db.delete(notifications).where(inArray(notifications.cardId, cardIds)).run();
    db.delete(activity).where(inArray(activity.cardId, cardIds)).run();
    db.delete(cards).where(inArray(cards.id, cardIds)).run();
  }

  export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps): void {
  ```

- [ ] **Step 4: Add the purge handler to** `server/src/routes/admin.ts`. Replace the end of `registerAdminRoutes` (the reset-password handler's close and the function's closing brace):
  ```ts
    void sendEmail({ to: target.email, subject: 'Password reset', html: `<p><a href="${link}">Set a new password</a></p>` });
    return reply.send({ link });
  });
}
  ```
  with:
  ```ts
    void sendEmail({ to: target.email, subject: 'Password reset', html: `<p><a href="${link}">Set a new password</a></p>` });
    return reply.send({ link });
  });

  app.post('/api/admin/purge', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const parsed = purgeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const { entity, id } = parsed.data;

    if (entity === 'card') {
      const card = db.select().from(cards).where(eq(cards.id, id)).get();
      if (!card) return reply.code(404).send({ error: 'Not found' });
      if (card.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be purged' });
      await purgeCards(db, deps.dataDir, [card.id]);
      deps.emit.boardChanged(card.boardId, req.user.id);
      return reply.code(204).send();
    }

    if (entity === 'list') {
      const list = db.select().from(lists).where(eq(lists.id, id)).get();
      if (!list) return reply.code(404).send({ error: 'Not found' });
      if (list.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be purged' });
      const cardIds = db.select({ id: cards.id }).from(cards).where(eq(cards.listId, id)).all().map((c) => c.id);
      await purgeCards(db, deps.dataDir, cardIds);
      db.delete(lists).where(eq(lists.id, id)).run();
      deps.emit.boardChanged(list.boardId, req.user.id);
      return reply.code(204).send();
    }

    const board = db.select().from(boards).where(eq(boards.id, id)).get();
    if (!board) return reply.code(404).send({ error: 'Not found' });
    if (board.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be purged' });
    const cardIds = db.select({ id: cards.id }).from(cards).where(eq(cards.boardId, id)).all().map((c) => c.id);
    await purgeCards(db, deps.dataDir, cardIds);
    db.delete(lists).where(eq(lists.boardId, id)).run();
    db.delete(labels).where(eq(labels.boardId, id)).run();
    db.delete(boardMembers).where(eq(boardMembers.boardId, id)).run();
    db.delete(activity).where(eq(activity.boardId, id)).run();
    db.delete(boards).where(eq(boards.id, id)).run();
    deps.emit.boardChanged(id, req.user.id);
    return reply.code(204).send();
  });
}
  ```

- [ ] **Step 5: Run the test — expect pass.**
  ```bash
  npm test -w server -- admin-purge
  ```
  Expected: `Test Files 1 passed`, `Tests 4 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add server/src/routes/admin.ts server/test/admin-purge.test.ts && git commit -m "$(cat <<'EOF'
  feat(admin): purge archived board/list/card with attachment-file cascade

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7.8: routes/admin.ts — archived-boards list + restore (un-archive)

Files: `server/src/routes/admin.ts`, `server/test/admin-archived.test.ts`

Adds two handlers: `GET /api/admin/archived-boards` → `BoardSummary[]` (boards with `archivedAt != null`, each with `cardCount`/`memberCount` and the requesting admin's `starred`), and `POST /api/admin/restore {entity:'board', id}` which un-archives a board (symmetric with Task 7.7's purge; 400 when the board is not archived, 404 when unknown). Section 11's AdminPage consumes both to power the archived-boards recover/purge panel (spec screen 6); without them disk usage and the "email not configured" notice were the only admin surfaces working and archived-board recovery 404'd.

- [ ] **Step 1: Write the failing test** `server/test/admin-archived.test.ts`.
  ```ts
  import { describe, it, expect } from 'vitest';
  import { makeApp, seedUser, login } from './helpers';
  import { createBoard } from './collab-helpers';

  async function setup() {
    const { app, db } = makeApp();
    seedUser(db, { email: 'admin@x.com', name: 'Admin', password: 'password123', isAdmin: true });
    const adminCookie = await login(app, 'admin@x.com', 'password123');
    return { app, db, adminCookie };
  }

  describe('GET /api/admin/archived-boards', () => {
    it('lists only archived boards as BoardSummary[]', async () => {
      const { app, adminCookie } = await setup();
      const live = await createBoard(app, adminCookie, 'team', 'Live board');
      const gone = await createBoard(app, adminCookie, 'team', 'Gone board');
      await app.inject({ method: 'DELETE', url: `/api/boards/${gone.boardId}`, headers: { cookie: adminCookie } });

      const res = await app.inject({ method: 'GET', url: '/api/admin/archived-boards', headers: { cookie: adminCookie } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(gone.boardId);
      expect(body[0].id).not.toBe(live.boardId);
      expect(body[0].name).toBe('Gone board');
      expect(body[0].archivedAt).not.toBeNull();
      expect(typeof body[0].cardCount).toBe('number');
      expect(typeof body[0].memberCount).toBe('number');
    });

    it('forbids a non-admin', async () => {
      const { app, db } = await setup();
      seedUser(db, { email: 'r@x.com', name: 'R', password: 'password123' });
      const regCookie = await login(app, 'r@x.com', 'password123');
      const res = await app.inject({ method: 'GET', url: '/api/admin/archived-boards', headers: { cookie: regCookie } });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/admin/restore', () => {
    it('un-archives a board so it reappears in the board list', async () => {
      const { app, adminCookie } = await setup();
      const { boardId } = await createBoard(app, adminCookie, 'team', 'Recover me');
      await app.inject({ method: 'DELETE', url: `/api/boards/${boardId}`, headers: { cookie: adminCookie } });

      const res = await app.inject({ method: 'POST', url: '/api/admin/restore', headers: { cookie: adminCookie }, payload: { entity: 'board', id: boardId } });
      expect(res.statusCode).toBe(204);

      const archived = await app.inject({ method: 'GET', url: '/api/admin/archived-boards', headers: { cookie: adminCookie } });
      expect(archived.json()).toHaveLength(0);

      const list = await app.inject({ method: 'GET', url: '/api/boards', headers: { cookie: adminCookie } });
      expect(list.json().some((b: { id: string }) => b.id === boardId)).toBe(true);
    });

    it('refuses to restore a board that is not archived', async () => {
      const { app, adminCookie } = await setup();
      const { boardId } = await createBoard(app, adminCookie, 'team', 'Still live');
      const res = await app.inject({ method: 'POST', url: '/api/admin/restore', headers: { cookie: adminCookie }, payload: { entity: 'board', id: boardId } });
      expect(res.statusCode).toBe(400);
    });

    it('404s for an unknown board', async () => {
      const { app, adminCookie } = await setup();
      const res = await app.inject({ method: 'POST', url: '/api/admin/restore', headers: { cookie: adminCookie }, payload: { entity: 'board', id: 'nope00000000' } });
      expect(res.statusCode).toBe(404);
    });

    it('forbids a non-admin', async () => {
      const { app, db } = await setup();
      seedUser(db, { email: 'r2@x.com', name: 'R2', password: 'password123' });
      const regCookie = await login(app, 'r2@x.com', 'password123');
      const res = await app.inject({ method: 'POST', url: '/api/admin/restore', headers: { cookie: regCookie }, payload: { entity: 'board', id: 'x' } });
      expect(res.statusCode).toBe(403);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.**
  ```bash
  npm test -w server -- admin-archived
  ```
  Expected: fails — neither route is registered yet, requests return 404, `Tests 6 failed`.

- [ ] **Step 3: Add the two handlers to** `server/src/routes/admin.ts`. Replace the end of `registerAdminRoutes` (the board-purge handler's close and the function's closing brace):
  ```ts
    deps.emit.boardChanged(id, req.user.id);
    return reply.code(204).send();
  });
}
  ```
  with:
  ```ts
    deps.emit.boardChanged(id, req.user.id);
    return reply.code(204).send();
  });

  app.get('/api/admin/archived-boards', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const rows = db.select().from(boards).where(isNotNull(boards.archivedAt)).all();
    const summaries: BoardSummary[] = rows.map((board) => {
      const cardCount = db.select().from(cards).where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt))).all().length;
      const memberCount = db.select().from(boardMembers).where(eq(boardMembers.boardId, board.id)).all().length;
      const membership = db.select().from(boardMembers).where(and(eq(boardMembers.boardId, board.id), eq(boardMembers.userId, req.user.id))).get();
      return {
        id: board.id,
        name: board.name,
        accentColor: board.accentColor as LabelColor,
        visibility: board.visibility,
        starred: membership?.starred ?? false,
        cardCount,
        memberCount,
        archivedAt: board.archivedAt,
      };
    });
    return reply.send(summaries);
  });

  app.post('/api/admin/restore', { preHandler: [requireAuth, requireAdmin] }, async (req, reply) => {
    const parsed = restoreSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });
    const board = db.select().from(boards).where(eq(boards.id, parsed.data.id)).get();
    if (!board) return reply.code(404).send({ error: 'Not found' });
    if (board.archivedAt === null) return reply.code(400).send({ error: 'Only archived items can be restored' });
    db.update(boards).set({ archivedAt: null }).where(eq(boards.id, board.id)).run();
    deps.emit.boardChanged(board.id, req.user.id);
    return reply.code(204).send();
  });
}
  ```

- [ ] **Step 4: Run the test — expect pass.**
  ```bash
  npm test -w server -- admin-archived
  ```
  Expected: `Test Files 1 passed`, `Tests 6 passed`.

- [ ] **Step 5: Run the whole server suite — expect all green.**
  ```bash
  npm test -w server
  ```
  Expected: every server suite passes, including this section's `realtime` (4), `jobs-duesoon` (5), `jobs-backup` (2), `admin-invites` (6), `admin-members` (8), `admin-purge` (4), `admin-archived` (6) — 35 new tests — alongside Sections 1–6.

- [ ] **Step 6: Type-check the whole server workspace** (confirms `admin.ts`, all imports now used — including `isNotNull`, `BoardSummary`, `LabelColor`, `restoreSchema` — and the `emit`/`AppDeps` wiring).
  ```bash
  npm run build -w server
  ```
  Expected: `tsc` exits 0 with no type errors.

- [ ] **Step 7: Commit.**
  ```bash
  git add server/src/routes/admin.ts server/test/admin-archived.test.ts && git commit -m "$(cat <<'EOF'
  feat(admin): archived-boards list + restore (un-archive), symmetric with purge

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Artifacts exported for later sections

- `server/src/realtime.ts`: `setupRealtime(server, db) → { io, emitBoardChanged(boardId, byUserId) }`. Emits `board:changed` (`BoardChangedEvent`) and `board:presence` (`PresenceEvent`) to room `board:{id}`; handshake authenticated from the `sid` cookie; `board:join`/`board:leave` access-checked via `canAccessBoard`. Section 8's `client/src/api/socket.ts` connects to this server and consumes both events.
- `server/src/jobs.ts`: `runDueSoon(db, now?)`, `runBackup(sqlite, dataDir, now?)`, `startJobs({ db, sqlite, dataDir })`.
- `server/src/routes/admin.ts`: `registerAdminRoutes(app, deps)` — `POST /api/admin/invites`, `GET /api/admin/members` (`{ members: UserPublic[]; diskUsageBytes: number; emailConfigured: boolean }`), `PATCH /api/admin/members/:id`, `POST /api/admin/members/:id/reset-password`, `POST /api/admin/purge`, `GET /api/admin/archived-boards` (`BoardSummary[]`), `POST /api/admin/restore {entity:'board', id}`. Section 11's Admin page consumes these.
- `server/src/index.ts`: production entrypoint now wires `setupRealtime` and `startJobs`; Section 12 (Docker/README) documents the `BACKUP_S3_*` env vars and the mounted `/data` volume (`app.db`, `uploads/`, `backups/`).


---

## Section 8: Client foundation: API layer, auth pages, shell, UI primitives

Builds the client's shared plumbing on top of the Section 1 Vite/React/Tailwind skeleton: the typed `fetch` wrapper + `ApiError`, the TanStack Query keys/hooks, the Socket.IO layer with `useBoardChannel`, the six warm-styled UI primitives, the three public auth pages, the authenticated `AppShell`, and the `App.tsx` router with an auth gate. It also drops thin placeholder pages for Home/Board/Admin/Settings so the router compiles; sections 9–11 replace those files (keeping the same named exports).

**Boundary notes**
- Placeholder files created here and **replaced** by later sections: `HomePage.tsx` (§9), `BoardPage.tsx` (§10), `AdminPage.tsx` + `SettingsPage.tsx` (§11), and the inline notifications-bell `<button>` slot in `AppShell.tsx` → `<NotificationsBell />` (§11). Later sections MUST keep these **named** exports so `App.tsx` imports keep resolving: `HomePage`, `BoardPage`, `AdminPage`, `SettingsPage`.
- I rely on Section 3's `GET /api/auth/me` (→ `Me` when authed, `401` when not) for the auth gate; execution is in order so it exists by now. Board/list/card/notification/profile **mutations** and the search-results UI belong to §9–§11 — they extend `queries.ts` importing my `qk`.
- `shared/types.ts` is imported via `@shared/types`, never redefined. The one composed type `CardDetailDto` (= `CardDto & {comments,attachments,activity}`, the `GET /api/cards/:id` shape) is defined in `queries.ts` because the contract does not name it.

### Files

**Create**
- `client/src/api/client.ts` — `api<T>()` fetch wrapper + `ApiError`
- `client/src/api/queries.ts` — `qk` keys + typed query/mutation hooks
- `client/src/api/socket.ts` — `getSocket()` + `useBoardChannel()`
- `client/src/components/ui/Button.tsx`
- `client/src/components/ui/Input.tsx`
- `client/src/components/ui/Avatar.tsx`
- `client/src/components/ui/Dialog.tsx`
- `client/src/components/ui/Menu.tsx`
- `client/src/components/ui/Toast.tsx`
- `client/src/components/AppShell.tsx`
- `client/src/pages/LoginPage.tsx`
- `client/src/pages/AcceptInvitePage.tsx`
- `client/src/pages/ResetPasswordPage.tsx`
- `client/src/pages/HomePage.tsx` (placeholder → §9)
- `client/src/pages/BoardPage.tsx` (placeholder → §10)
- `client/src/pages/AdminPage.tsx` (placeholder → §11)
- `client/src/pages/SettingsPage.tsx` (placeholder → §11)

**Modify**
- `client/package.json` — add `@tanstack/react-query`, `react-router`, `socket.io-client`
- `client/vite.config.ts` — add `/socket.io` ws proxy
- `client/src/App.tsx` — replace scaffold with router + auth gate
- remove `client/src/App.test.tsx` — obsolete scaffold smoke test

**Test**
- `client/src/api/client.test.ts`
- `client/src/api/queries.test.ts`
- `client/src/api/socket.test.tsx`

---

### Task 8.1: API fetch wrapper `client.ts` + client dependencies (TDD)

**Files:** `client/package.json`, `client/src/api/client.ts`, `client/src/api/client.test.ts`

- [ ] **Step 1: Add client deps.** In `client/package.json`, replace the `"dependencies"` block:
  ```json
      "dependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
  ```
  with:
  ```json
      "dependencies": {
        "@tanstack/react-query": "^5.62.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-router": "^7.1.0",
        "socket.io-client": "^4.8.0"
      },
  ```

- [ ] **Step 2: Install.** Run `npm install` (from repo root).
  - Expected: `added N packages` (includes `react-router`, `@tanstack/react-query`, `socket.io-client` + transitive deps); exit 0, no errors.

- [ ] **Step 3: Write the failing test** `client/src/api/client.test.ts`:
  ```ts
  import { describe, it, expect, vi, afterEach } from 'vitest';
  import { api, ApiError } from './client';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('api', () => {
    it('returns parsed JSON on a 2xx response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ id: 'u1' }), { status: 200 })),
      );
      const result = await api<{ id: string }>('/auth/me');
      expect(result).toEqual({ id: 'u1' });
    });

    it('throws ApiError carrying status and the server error message on non-2xx', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })),
      );
      await expect(api('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
        name: 'ApiError',
        status: 401,
        message: 'Invalid credentials',
      });
    });

    it('falls back to a generic message when the error body has no error field', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
      await expect(api('/boards')).rejects.toMatchObject({ status: 500, message: 'Something went wrong' });
    });

    it('always sends credentials and JSON content-type for a string body', async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await api('/boards', { method: 'POST', body: JSON.stringify({ name: 'x' }) });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/boards');
      expect(init.credentials).toBe('include');
      expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
    });
  });
  ```

- [ ] **Step 4: Run it — expect failure.** `npm test -w client -- api/client`
  - Expected: FAIL — `Failed to load url ./client` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 5: Implement** `client/src/api/client.ts` (full file):
  ```ts
  export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  function errorMessage(data: unknown): string {
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
    ) {
      return (data as { error: string }).error;
    }
    return 'Something went wrong';
  }

  export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const headers = new Headers(opts.headers);
    if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`/api${path}`, { ...opts, credentials: 'include', headers });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(data));
    }
    return data as T;
  }
  ```

- [ ] **Step 6: Run it — expect pass.** `npm test -w client -- api/client`
  - Expected: `Test Files 1 passed (1)` · `Tests 4 passed (4)`.

- [ ] **Step 7: Commit.**
  ```
  git add -A && git commit -m "feat(client): typed api() fetch wrapper with ApiError" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 8.2: Query keys + typed hooks `queries.ts` (TDD)

**Files:** `client/src/api/queries.ts`, `client/src/api/queries.test.ts`

- [ ] **Step 1: Write the failing test** `client/src/api/queries.test.ts` (pins the contract query-key shapes; no provider needed):
  ```ts
  import { describe, it, expect } from 'vitest';
  import { qk } from './queries';

  describe('query keys', () => {
    it('match the contract shapes exactly', () => {
      expect(qk.me).toEqual(['me']);
      expect(qk.boards).toEqual(['boards']);
      expect(qk.board('b1')).toEqual(['board', 'b1']);
      expect(qk.card('c1')).toEqual(['card', 'c1']);
      expect(qk.notifications).toEqual(['notifications']);
      expect(qk.search('hello')).toEqual(['search', 'hello']);
    });
  });
  ```

- [ ] **Step 2: Run it — expect failure.** `npm test -w client -- api/queries`
  - Expected: FAIL — `Failed to load url ./queries` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement** `client/src/api/queries.ts` (full file):
  ```ts
  import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
  import type {
    Me,
    BoardSummary,
    BoardDetail,
    CardDto,
    CommentDto,
    AttachmentDto,
    ActivityDto,
    NotificationDto,
    SearchResult,
    Id,
  } from '@shared/types';
  import { api } from './client';

  export type CardDetailDto = CardDto & {
    comments: CommentDto[];
    attachments: AttachmentDto[];
    activity: ActivityDto[];
  };

  export const qk = {
    me: ['me'] as const,
    boards: ['boards'] as const,
    board: (id: Id) => ['board', id] as const,
    card: (id: Id) => ['card', id] as const,
    notifications: ['notifications'] as const,
    search: (q: string) => ['search', q] as const,
  };

  export function useMe() {
    return useQuery({
      queryKey: qk.me,
      queryFn: () => api<Me>('/auth/me'),
      retry: false,
      staleTime: Infinity,
    });
  }

  export function useBoards() {
    return useQuery({
      queryKey: qk.boards,
      queryFn: () => api<BoardSummary[]>('/boards'),
    });
  }

  export function useBoard(boardId: Id) {
    return useQuery({
      queryKey: qk.board(boardId),
      queryFn: () => api<BoardDetail>(`/boards/${boardId}`),
    });
  }

  export function useCard(cardId: Id) {
    return useQuery({
      queryKey: qk.card(cardId),
      queryFn: () => api<CardDetailDto>(`/cards/${cardId}`),
    });
  }

  export function useNotifications() {
    return useQuery({
      queryKey: qk.notifications,
      queryFn: () => api<NotificationDto[]>('/notifications'),
    });
  }

  export function useSearch(q: string) {
    return useQuery({
      queryKey: qk.search(q),
      queryFn: () => api<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
      enabled: q.trim().length > 0,
    });
  }

  export function useLogin() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: { email: string; password: string }) =>
        api<Me>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: (me) => qc.setQueryData(qk.me, me),
    });
  }

  export function useAcceptInvite() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: { token: string; name: string; password: string }) =>
        api<Me>('/auth/accept-invite', { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: (me) => qc.setQueryData(qk.me, me),
    });
  }

  export function useResetPassword() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: { token: string; password: string }) =>
        api<Me>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
      onSuccess: (me) => qc.setQueryData(qk.me, me),
    });
  }

  export function useLogout() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
      onSuccess: () => qc.clear(),
    });
  }
  ```

- [ ] **Step 4: Run it — expect pass.** `npm test -w client -- api/queries`
  - Expected: `Test Files 1 passed (1)` · `Tests 1 passed (1)`.

- [ ] **Step 5: Commit.**
  ```
  git add -A && git commit -m "feat(client): query keys and typed react-query hooks" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 8.3: Socket layer `socket.ts` + `useBoardChannel` (TDD) + vite ws proxy

**Files:** `client/src/api/socket.ts`, `client/src/api/socket.test.tsx`, `client/vite.config.ts`

- [ ] **Step 1: Write the failing test** `client/src/api/socket.test.tsx` (mocks `socket.io-client` with a hand-driven fake; asserts the 150 ms debounce coalesces bursts and ignores foreign boards):
  ```tsx
  import { renderHook } from '@testing-library/react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import type { ReactNode } from 'react';
  import { describe, it, expect, vi, afterEach } from 'vitest';

  const { fakeSocket } = vi.hoisted(() => {
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    return {
      fakeSocket: {
        connected: true,
        emit: vi.fn(),
        on(event: string, cb: (...args: unknown[]) => void) {
          (handlers[event] ??= []).push(cb);
        },
        off(event: string, cb: (...args: unknown[]) => void) {
          handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
        },
        server(event: string, ...args: unknown[]) {
          (handlers[event] ?? []).forEach((h) => h(...args));
        },
      },
    };
  });

  vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

  import { useBoardChannel } from './socket';

  function renderChannel(boardId: string, qc: QueryClient) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return renderHook(() => useBoardChannel(boardId), { wrapper });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useBoardChannel', () => {
    it('coalesces rapid board:changed events into one invalidation after 150ms', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const qc = new QueryClient();
      const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
      renderChannel('board1', qc);

      fakeSocket.server('board:changed', { boardId: 'board1', byUserId: 'u2' });
      fakeSocket.server('board:changed', { boardId: 'board1', byUserId: 'u2' });
      fakeSocket.server('board:changed', { boardId: 'board1', byUserId: 'u2' });
      expect(invalidate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['board', 'board1'] });
    });

    it('ignores board:changed for a different board', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const qc = new QueryClient();
      const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
      renderChannel('board1', qc);

      fakeSocket.server('board:changed', { boardId: 'other', byUserId: 'u2' });
      vi.advanceTimersByTime(150);
      expect(invalidate).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run it — expect failure.** `npm test -w client -- api/socket`
  - Expected: FAIL — `Failed to load url ./socket` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement** `client/src/api/socket.ts` (full file):
  ```ts
  import { useEffect, useState } from 'react';
  import { useQueryClient } from '@tanstack/react-query';
  import { io, type Socket } from 'socket.io-client';
  import type { BoardChangedEvent, PresenceEvent, Id } from '@shared/types';
  import { qk } from './queries';

  let socket: Socket | null = null;

  export function getSocket(): Socket {
    if (!socket) {
      socket = io({ withCredentials: true, autoConnect: true });
    }
    return socket;
  }

  export interface BoardChannel {
    connected: boolean;
    presence: PresenceEvent['users'];
  }

  export function useBoardChannel(boardId: Id): BoardChannel {
    const qc = useQueryClient();
    const [connected, setConnected] = useState(() => getSocket().connected);
    const [presence, setPresence] = useState<PresenceEvent['users']>([]);

    useEffect(() => {
      const s = getSocket();
      let timer: ReturnType<typeof setTimeout> | null = null;

      const scheduleInvalidate = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          qc.invalidateQueries({ queryKey: qk.board(boardId) });
        }, 150);
      };

      const onChanged = (evt: BoardChangedEvent) => {
        if (evt.boardId === boardId) scheduleInvalidate();
      };
      const onPresence = (evt: PresenceEvent) => {
        if (evt.boardId === boardId) setPresence(evt.users);
      };
      const onConnect = () => {
        setConnected(true);
        s.emit('board:join', { boardId });
        qc.invalidateQueries({ queryKey: qk.board(boardId) });
      };
      const onDisconnect = () => setConnected(false);

      s.on('board:changed', onChanged);
      s.on('board:presence', onPresence);
      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);

      if (s.connected) {
        s.emit('board:join', { boardId });
      }

      return () => {
        s.emit('board:leave', { boardId });
        s.off('board:changed', onChanged);
        s.off('board:presence', onPresence);
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        if (timer) clearTimeout(timer);
        setPresence([]);
      };
    }, [boardId, qc]);

    return { connected, presence };
  }
  ```

- [ ] **Step 4: Run it — expect pass.** `npm test -w client -- api/socket`
  - Expected: `Test Files 1 passed (1)` · `Tests 2 passed (2)`.

- [ ] **Step 5: Add the `/socket.io` dev proxy.** In `client/vite.config.ts`, replace the `proxy` block:
  ```ts
        proxy: {
          '/api': 'http://localhost:3000',
        },
  ```
  with:
  ```ts
        proxy: {
          '/api': 'http://localhost:3000',
          '/socket.io': { target: 'http://localhost:3000', ws: true },
        },
  ```

- [ ] **Step 6: Commit.**
  ```
  git add -A && git commit -m "feat(client): socket layer with debounced useBoardChannel" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 8.4: UI primitives (Button, Input, Avatar, Dialog, Menu, Toast)

**Files:** `client/src/components/ui/{Button,Input,Avatar,Dialog,Menu,Toast}.tsx`

Presentational — verified by the full build in Task 8.7 and by E2E later, per the contract's testing conventions (no unit tests).

- [ ] **Step 1: Create** `client/src/components/ui/Button.tsx`:
  ```tsx
  import type { ButtonHTMLAttributes } from 'react';

  type Variant = 'primary' | 'ghost' | 'danger';

  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<Variant, string> = {
    primary: 'bg-coral text-paper hover:bg-rust',
    ghost: 'bg-transparent text-rust hover:bg-sand/50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  export function Button({
    variant = 'primary',
    className = '',
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
    return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
  }
  ```

- [ ] **Step 2: Create** `client/src/components/ui/Input.tsx`:
  ```tsx
  import type { InputHTMLAttributes } from 'react';

  export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return (
      <input
        className={`w-full rounded-lg border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-latte focus:border-coral focus:outline-none ${className}`}
        {...props}
      />
    );
  }
  ```

- [ ] **Step 3: Create** `client/src/components/ui/Avatar.tsx`:
  ```tsx
  import { LABEL_HEX, type LabelColor } from '@shared/types';

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  }

  export function Avatar({
    name,
    color,
    size = 32,
  }: {
    name: string;
    color: string;
    size?: number;
  }) {
    const hex = LABEL_HEX[color as LabelColor] ?? LABEL_HEX.gray;
    return (
      <span
        className="inline-flex select-none items-center justify-center rounded-full font-medium text-paper"
        style={{ backgroundColor: hex, width: size, height: size, fontSize: size * 0.4 }}
        title={name}
        aria-label={name}
      >
        {initials(name)}
      </span>
    );
  }
  ```

- [ ] **Step 4: Create** `client/src/components/ui/Dialog.tsx`:
  ```tsx
  import { type ReactNode, useEffect } from 'react';

  export function Dialog({
    open,
    onClose,
    title,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
  }) {
    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-24"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-full max-w-lg rounded-[10px] border border-sand bg-paper p-6 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {title && <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>}
          {children}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Create** `client/src/components/ui/Menu.tsx`:
  ```tsx
  import { type ReactNode, useEffect, useRef, useState } from 'react';

  export interface MenuItem {
    label: string;
    onSelect: () => void;
    danger?: boolean;
  }

  export function Menu({ trigger, items }: { trigger: ReactNode; items: MenuItem[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;
      const onDown = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      };
      window.addEventListener('mousedown', onDown);
      return () => window.removeEventListener('mousedown', onDown);
    }, [open]);

    return (
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center">
          {trigger}
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-sand bg-paper py-1 shadow-sm">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-sand/40 ${
                  item.danger ? 'text-red-700' : 'text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 6: Create** `client/src/components/ui/Toast.tsx`:
  ```tsx
  import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

  interface ToastItem {
    id: number;
    message: string;
  }
  interface ToastContextValue {
    toast: (message: string) => void;
  }

  const ToastContext = createContext<ToastContextValue | null>(null);
  let nextId = 1;

  export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);

    const toast = useCallback((message: string) => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }, []);

    return (
      <ToastContext.Provider value={{ toast }}>
        {children}
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className="rounded-lg border border-sand bg-ink px-4 py-2 text-sm text-paper shadow-sm"
            >
              {t.message}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    );
  }

  export function useToast(): (message: string) => void {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx.toast;
  }
  ```

- [ ] **Step 7: Commit.**
  ```
  git add -A && git commit -m "feat(client): warm-styled ui primitives (button, input, avatar, dialog, menu, toast)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 8.5: Auth pages (Login, AcceptInvite, ResetPassword)

**Files:** `client/src/pages/{LoginPage,AcceptInvitePage,ResetPasswordPage}.tsx`

Presentational forms wired to the auth mutations; verified by the build (8.7) and E2E later.

- [ ] **Step 1: Create** `client/src/pages/LoginPage.tsx`:
  ```tsx
  import { useState, type FormEvent } from 'react';
  import { useNavigate } from 'react-router';
  import { useLogin } from '../api/queries';
  import { ApiError } from '../api/client';
  import { Button } from '../components/ui/Button';
  import { Input } from '../components/ui/Input';

  export function LoginPage() {
    const navigate = useNavigate();
    const login = useLogin();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      login.mutate({ email, password }, { onSuccess: () => navigate('/', { replace: true }) });
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-4">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-4 rounded-[10px] border border-sand bg-paper p-8"
        >
          <h1 className="text-center text-2xl font-semibold text-ink">company trello</h1>
          <label className="flex flex-col gap-1 text-sm text-rust">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-rust">
            Password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {login.isError && (
            <p className="text-sm text-red-700" role="alert">
              {login.error instanceof ApiError ? login.error.message : 'Something went wrong'}
            </p>
          )}
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create** `client/src/pages/AcceptInvitePage.tsx`:
  ```tsx
  import { useState, type FormEvent } from 'react';
  import { useNavigate, useParams } from 'react-router';
  import { useAcceptInvite } from '../api/queries';
  import { ApiError } from '../api/client';
  import { Button } from '../components/ui/Button';
  import { Input } from '../components/ui/Input';

  export function AcceptInvitePage() {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const accept = useAcceptInvite();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      accept.mutate({ token, name, password }, { onSuccess: () => navigate('/', { replace: true }) });
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-4">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-4 rounded-[10px] border border-sand bg-paper p-8"
        >
          <h1 className="text-center text-2xl font-semibold text-ink">Join the team</h1>
          <p className="text-center text-sm text-latte">Set your name and a password to finish.</p>
          <label className="flex flex-col gap-1 text-sm text-rust">
            Name
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-rust">
            Password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          {accept.isError && (
            <p className="text-sm text-red-700" role="alert">
              {accept.error instanceof ApiError ? accept.error.message : 'Something went wrong'}
            </p>
          )}
          <Button type="submit" disabled={accept.isPending}>
            {accept.isPending ? 'Joining…' : 'Join'}
          </Button>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 3: Create** `client/src/pages/ResetPasswordPage.tsx`:
  ```tsx
  import { useState, type FormEvent } from 'react';
  import { useNavigate, useParams } from 'react-router';
  import { useResetPassword } from '../api/queries';
  import { ApiError } from '../api/client';
  import { Button } from '../components/ui/Button';
  import { Input } from '../components/ui/Input';

  export function ResetPasswordPage() {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const reset = useResetPassword();
    const [password, setPassword] = useState('');

    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      reset.mutate({ token, password }, { onSuccess: () => navigate('/', { replace: true }) });
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-4">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-4 rounded-[10px] border border-sand bg-paper p-8"
        >
          <h1 className="text-center text-2xl font-semibold text-ink">Set a new password</h1>
          <label className="flex flex-col gap-1 text-sm text-rust">
            New password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          {reset.isError && (
            <p className="text-sm text-red-700" role="alert">
              {reset.error instanceof ApiError ? reset.error.message : 'Something went wrong'}
            </p>
          )}
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 4: Commit.**
  ```
  git add -A && git commit -m "feat(client): login, accept-invite, and reset-password pages" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 8.6: AppShell (header, search, notifications slot, avatar menu)

**Files:** `client/src/components/AppShell.tsx`

- [ ] **Step 1: Create** `client/src/components/AppShell.tsx` (full file). The bell `<button>` is a placeholder slot §11 swaps for `<NotificationsBell />`:
  ```tsx
  import { type ReactNode, type FormEvent, useState } from 'react';
  import { Link, useNavigate, useSearchParams } from 'react-router';
  import { useMe, useLogout } from '../api/queries';
  import { Avatar } from './ui/Avatar';
  import { Menu, type MenuItem } from './ui/Menu';
  import { Input } from './ui/Input';

  export function AppShell({ children }: { children: ReactNode }) {
    const me = useMe();
    const logout = useLogout();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [q, setQ] = useState(params.get('q') ?? '');

    const onSearch = (e: FormEvent) => {
      e.preventDefault();
      const trimmed = q.trim();
      navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
    };

    const onLogout = () => {
      logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
    };

    const menuItems: MenuItem[] = me.data
      ? [
          { label: 'Settings', onSelect: () => navigate('/settings') },
          ...(me.data.isAdmin ? [{ label: 'Admin', onSelect: () => navigate('/admin') }] : []),
          { label: 'Log out', onSelect: onLogout },
        ]
      : [];

    return (
      <div className="min-h-screen bg-cream">
        <header className="flex h-14 items-center gap-4 border-b border-sand bg-paper px-4">
          <Link to="/" className="shrink-0 font-semibold text-ink">
            company trello
          </Link>
          <form onSubmit={onSearch} className="max-w-md flex-1">
            <Input
              type="search"
              placeholder="Search cards…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search cards"
            />
          </form>
          <div className="ml-auto flex items-center gap-3">
            {/* Notifications slot — replaced by <NotificationsBell /> in section 11 */}
            <button type="button" aria-label="Notifications" className="text-latte hover:text-rust">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>
            {me.data && (
              <Menu
                trigger={<Avatar name={me.data.name} color={me.data.avatarColor} />}
                items={menuItems}
              />
            )}
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit.**
  ```
  git add -A && git commit -m "feat(client): app shell header with search, notifications slot, avatar menu" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 8.7: Placeholder pages + App router with auth gate + build & manual verify

**Files:** `client/src/pages/{HomePage,BoardPage,AdminPage,SettingsPage}.tsx`, `client/src/App.tsx`, remove `client/src/App.test.tsx`

- [ ] **Step 1: Create placeholder** `client/src/pages/HomePage.tsx` (§9 replaces, keeping the `HomePage` named export):
  ```tsx
  export function HomePage() {
    return <div className="p-6 text-latte">Home — boards grid arrives in section 9.</div>;
  }
  ```

- [ ] **Step 2: Create placeholder** `client/src/pages/BoardPage.tsx` (§10 replaces, keeping the `BoardPage` named export):
  ```tsx
  export function BoardPage() {
    return <div className="p-6 text-latte">Board — columns and cards arrive in section 10.</div>;
  }
  ```

- [ ] **Step 3: Create placeholder** `client/src/pages/AdminPage.tsx` (§11 replaces, keeping the `AdminPage` named export):
  ```tsx
  export function AdminPage() {
    return <div className="p-6 text-latte">Admin — arrives in section 11.</div>;
  }
  ```

- [ ] **Step 4: Create placeholder** `client/src/pages/SettingsPage.tsx` (§11 replaces, keeping the `SettingsPage` named export):
  ```tsx
  export function SettingsPage() {
    return <div className="p-6 text-latte">Settings — arrives in section 11.</div>;
  }
  ```

- [ ] **Step 5: Remove the obsolete scaffold test.** The Section 1 `App.test.tsx` asserts a standalone heading that no longer renders synchronously (App is now a router behind an auth gate). Routing is covered by E2E.
  ```
  git rm client/src/App.test.tsx
  ```

- [ ] **Step 6: Replace** `client/src/App.tsx` — full new contents (the Section 1 heading version is entirely superseded):
  ```tsx
  import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { ToastProvider } from './components/ui/Toast';
  import { AppShell } from './components/AppShell';
  import { useMe } from './api/queries';
  import { LoginPage } from './pages/LoginPage';
  import { AcceptInvitePage } from './pages/AcceptInvitePage';
  import { ResetPasswordPage } from './pages/ResetPasswordPage';
  import { HomePage } from './pages/HomePage';
  import { BoardPage } from './pages/BoardPage';
  import { AdminPage } from './pages/AdminPage';
  import { SettingsPage } from './pages/SettingsPage';

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: false },
    },
  });

  function ProtectedLayout() {
    const me = useMe();
    if (me.isPending) {
      return <div className="min-h-screen bg-cream" />;
    }
    if (me.isError || !me.data) {
      return <Navigate to="/login" replace />;
    }
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  export default function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/invite/:token" element={<AcceptInvitePage />} />
              <Route path="/reset/:token" element={<ResetPasswordPage />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/b/:boardId" element={<BoardPage />} />
                <Route path="/b/:boardId/c/:cardId" element={<BoardPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  }
  ```

- [ ] **Step 7: Run the full client unit suite.** `npm test -w client`
  - Expected: `Test Files 3 passed (3)` · `Tests 7 passed (7)` (client 4, queries 1, socket 2).

- [ ] **Step 8: Typecheck + build the client.** `npm run build -w client`
  - Expected: `tsc -b` reports no type errors, then Vite prints `✓ built in …` and writes `client/dist/index.html` + `client/dist/assets/*`. Exit 0.

- [ ] **Step 9: Manual verify against the real server.** In one terminal run `npm run dev` (server on `:3000`, client on `:5173`; the seeded admin comes from `.env` `ADMIN_EMAIL=admin@example.com` / `ADMIN_PASSWORD=change-me` via Section 3 bootstrap). Then in a browser:
  - Open `http://localhost:5173/` → the auth gate fetches `/api/auth/me` (401) and redirects to `/login`; the login card renders on cream with the "company trello" heading.
  - Submit a wrong password → an inline red error appears (e.g. "Invalid credentials"), no crash.
  - Log in with the admin credentials → lands on `/` inside the AppShell; header shows the home link, search box, bell slot, and an initials avatar.
  - Type `hello` in search, press Enter → URL becomes `/?q=hello` (HomePage placeholder still renders; results are §9).
  - Open the avatar menu → shows Settings, Admin (admin account), Log out. Click Settings → `/settings` placeholder; click Admin → `/admin` placeholder.
  - Click the avatar menu → Log out → redirected to `/login`; manually visiting `/` again redirects back to `/login`.
  - Stop with Ctrl-C.

- [ ] **Step 10: Commit.**
  ```
  git add -A && git commit -m "feat(client): app router with auth gate and placeholder pages" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Section verification (all must hold before section 9)

- [ ] `npm test -w client` → `Test Files 3 passed (3)` · `Tests 7 passed (7)`.
- [ ] `npm run build -w client` → clean typecheck, `client/dist` produced.
- [ ] `npm run e2e` (from Section 1) still green: `/` redirects to `/login`, whose heading "company trello" is visible → the existing smoke spec passes unchanged.
- [ ] Manual: unauthenticated `/` → `/login`; bad login shows inline error; good login → AppShell + Home placeholder; search sets `?q=`; avatar menu (Settings/Admin/Log out) navigates; logout returns to `/login`.
- [ ] No `any`, no unused locals/params (enforced by `tsc -b` under `tsconfig.base.json`).


---

## Section 9: Client home page: board grid, create dialog, search results

Builds the authenticated Home page (`/`): a warm board grid grouped **Starred → Team → Private**, a `BoardTile` with an accent-color strip + name + card/member counts + star toggle, a "New board" tile opening a create dialog (name, visibility defaulting to `team`, an 8-swatch `LabelColor` accent picker) that creates the board and navigates to it, an empty state inviting the first board, and a global search results view keyed off the `?q=` URL param that lists `SearchResult`s linking to `/b/:boardId/c/:cardId`. All UI is warm-styled with the contract theme tokens (cream page, paper tiles, sand borders).

### Depends on (lower-numbered sections — assumed artifacts)

This section consumes Section 8 ("Client foundation") artifacts. Their exact prop signatures are **not** pinned by the contract, so — to stay executable — this section is **self-contained**: it builds Home UI from plain elements + Tailwind theme classes and depends only on the following stable, minimal surface:

- **`client/src/api/client.ts`** exports `async function api<T>(path: string, opts?: RequestInit): Promise<T>` — a `fetch` wrapper that sets `credentials: 'include'`, sets `Content-Type: application/json` when a `body` is passed, parses the JSON response (returns `undefined` for an empty/204 body), and throws `ApiError` on non-2xx. It also exports `class ApiError extends Error { status: number }`.
- **`client/src/api/queries.ts`** already exports a `queryClient`, `useMe()`, `useBoards()`, and `useSearch()` (all from Section 8), and therefore already imports `useQuery` from `@tanstack/react-query` and `api` from `./client`. Section 9 **adds only the `useCreateBoard` and `useToggleStar` mutation hooks** to this file — it does NOT redefine `useBoards`/`useSearch` (they exist from Section 8) and does not add board-page or notification hooks (those belong to Sections 10/11).
- **`client/src/App.tsx`** routes `/` to `client/src/pages/HomePage.tsx` inside `AppShell`, and Section 8 created `HomePage.tsx` as a placeholder stub. **Section 9 replaces the stub's contents** (Write), so no `App.tsx` edit is needed.
- **`main.tsx`** wraps the app in `QueryClientProvider` (with `queryClient`) and a `react-router` router.
- **Router package is `react-router` v7** (contract: `react-router ^7`); `useNavigate`, `useSearchParams`, `Link`, `MemoryRouter` are imported from `react-router`.
- **AppShell search box → `?q=` contract:** Section 8's `AppShell` search input navigates to `/?q=<encodeURIComponent(query)>`. Section 9's `HomePage` reads `searchParams.get('q')` and renders the search results view when it is non-empty. (If the Section 8 executor did not wire the search box to `/?q=`, do so there — one `navigate('/?q=' + encodeURIComponent(q))` call — before verifying this section end-to-end.)

Consumed types from `@shared/types` (never redefined): `BoardSummary`, `BoardDetail`, `SearchResult`, `LabelColor`, `Visibility`, and the `LABEL_HEX` const.

### Files

**Create**
- `client/src/lib/groupBoards.ts` — pure `groupBoards(boards)` partition helper
- `client/src/components/BoardTile.tsx` — `BoardTile` + `NewBoardTile`
- `client/src/components/CreateBoardDialog.tsx` — create-board modal form
- `client/src/components/SearchResults.tsx` — `?q=` search results view

**Modify**
- `client/src/api/queries.ts` — add `useCreateBoard`, `useToggleStar` (`useBoards`/`useSearch` are already provided by Section 8)
- `client/src/pages/HomePage.tsx` — replace Section 8 stub with the full Home page

**Test**
- `client/src/lib/groupBoards.test.ts` — unit test for the partition helper
- `client/src/pages/HomePage.test.tsx` — integration render test (empty state + grouped sections)

---

### Task 9.1: Board grouping helper (TDD)

**Files:** `client/src/lib/groupBoards.ts`, `client/src/lib/groupBoards.test.ts`

- [ ] **Step 1: Write the failing test `client/src/lib/groupBoards.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { groupBoards } from './groupBoards';
  import type { BoardSummary } from '@shared/types';

  function board(over: Partial<BoardSummary>): BoardSummary {
    return {
      id: 'b',
      name: 'B',
      accentColor: 'coral',
      visibility: 'team',
      starred: false,
      cardCount: 0,
      memberCount: 1,
      archivedAt: null,
      ...over,
    };
  }

  describe('groupBoards', () => {
    it('partitions into starred, team, and private without duplicating starred boards', () => {
      const groups = groupBoards([
        board({ id: 's1', name: 'Starred team', visibility: 'team', starred: true }),
        board({ id: 't1', name: 'Team one', visibility: 'team', starred: false }),
        board({ id: 'p1', name: 'Private one', visibility: 'private', starred: false }),
        board({ id: 'sp', name: 'Starred private', visibility: 'private', starred: true }),
      ]);
      expect(groups.starred.map((b) => b.id)).toEqual(['s1', 'sp']);
      expect(groups.team.map((b) => b.id)).toEqual(['t1']);
      expect(groups.private.map((b) => b.id)).toEqual(['p1']);
    });

    it('returns empty groups for no boards', () => {
      expect(groupBoards([])).toEqual({ starred: [], team: [], private: [] });
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.** `npm test -w client -- groupBoards`
  - Expected: FAIL — Vitest cannot resolve `./groupBoards` (`Failed to load url ./groupBoards` / module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement `client/src/lib/groupBoards.ts`.** Full file:
  ```ts
  import type { BoardSummary } from '@shared/types';

  export interface BoardGroups {
    starred: BoardSummary[];
    team: BoardSummary[];
    private: BoardSummary[];
  }

  export function groupBoards(boards: BoardSummary[]): BoardGroups {
    const starred = boards.filter((b) => b.starred);
    const rest = boards.filter((b) => !b.starred);
    return {
      starred,
      team: rest.filter((b) => b.visibility === 'team'),
      private: rest.filter((b) => b.visibility === 'private'),
    };
  }
  ```

- [ ] **Step 4: Run the test — expect pass.** `npm test -w client -- groupBoards`
  - Expected: `Test Files 1 passed (1)` · `Tests 2 passed (2)`.

- [ ] **Step 5: Commit.**
  ```
  git add client/src/lib/groupBoards.ts client/src/lib/groupBoards.test.ts
  git commit -m "feat(home): groupBoards helper partitions starred/team/private" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 9.2: Home query + mutation hooks

**Files:** `client/src/api/queries.ts` (modify)

- [ ] **Step 1: Merge the required imports at the top of `client/src/api/queries.ts`.** Section 8's file already imports `useQuery` from `@tanstack/react-query` and `api` from `./client`. Ensure the top of the file ends up with (merge into the existing lines — add `useMutation`, `useQueryClient`, and the `@shared/types` value/type import; keep whatever `useMe`/`Me` imports Section 8 added):
  ```ts
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
  import { api } from './client';
  import type { BoardDetail, LabelColor, Visibility } from '@shared/types';
  ```

- [ ] **Step 2: Append the two new hooks to the end of `client/src/api/queries.ts`.** `useBoards` and `useSearch` already exist from Section 8 — do NOT redefine them (that would be a duplicate-function compile error). Paths passed to `api()` do NOT include the `/api` prefix (`api()` prepends it internally). Paste verbatim:
  ```ts
  export function useCreateBoard() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { name: string; visibility: Visibility; accentColor: LabelColor }) =>
        api<BoardDetail>('/boards', { method: 'POST', body: JSON.stringify(input) }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
    });
  }

  export function useToggleStar() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { boardId: string; starred: boolean }) =>
        api<void>(`/boards/${input.boardId}/star`, {
          method: 'POST',
          body: JSON.stringify({ starred: input.starred }),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
    });
  }
  ```

- [ ] **Step 3: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` reports no type errors, then Vite prints `✓ built in …` and writes `client/dist`. (The new hooks are exported but not yet consumed — that is allowed; `noUnusedLocals` does not flag exports.)

- [ ] **Step 4: Commit.**
  ```
  git add client/src/api/queries.ts
  git commit -m "feat(home): create-board + toggle-star mutation hooks" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 9.3: BoardTile + NewBoardTile

**Files:** `client/src/components/BoardTile.tsx`

- [ ] **Step 1: Create `client/src/components/BoardTile.tsx`.** Full file:
  ```tsx
  import { LABEL_HEX, type BoardSummary } from '@shared/types';

  export function BoardTile({
    board,
    onOpen,
    onToggleStar,
  }: {
    board: BoardSummary;
    onOpen: () => void;
    onToggleStar: () => void;
  }) {
    return (
      <div
        onClick={onOpen}
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-sand bg-paper transition hover:border-latte"
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: LABEL_HEX[board.accentColor] }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-ink">{board.name}</h3>
            <button
              type="button"
              aria-label={board.starred ? 'Unstar board' : 'Star board'}
              aria-pressed={board.starred}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar();
              }}
              className="shrink-0 text-lg leading-none"
              style={{ color: board.starred ? LABEL_HEX.amber : '#B8865B' }}
            >
              {board.starred ? '★' : '☆'}
            </button>
          </div>
          <p className="mt-3 text-sm text-latte">
            {board.cardCount} {board.cardCount === 1 ? 'card' : 'cards'} · {board.memberCount}{' '}
            {board.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
      </div>
    );
  }

  export function NewBoardTile({ onClick }: { onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[92px] items-center justify-center rounded-lg border border-dashed border-sand bg-paper/60 text-latte transition hover:border-coral hover:text-coral"
      >
        <span className="text-sm font-medium">+ New board</span>
      </button>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/BoardTile.tsx
  git commit -m "feat(home): BoardTile with accent strip + star, NewBoardTile" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 9.4: CreateBoardDialog

**Files:** `client/src/components/CreateBoardDialog.tsx`

- [ ] **Step 1: Create `client/src/components/CreateBoardDialog.tsx`.** Full file (name field, visibility toggle defaulting to `team`, 8-swatch accent picker; creating navigates to the new board and closes):
  ```tsx
  import { useState, type FormEvent } from 'react';
  import { useNavigate } from 'react-router';
  import { LABEL_HEX, type LabelColor, type Visibility } from '@shared/types';
  import { useCreateBoard } from '../api/queries';

  const COLORS: LabelColor[] = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

  export function CreateBoardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [name, setName] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('team');
    const [accentColor, setAccentColor] = useState<LabelColor>('coral');
    const createBoard = useCreateBoard();
    const navigate = useNavigate();

    if (!open) return null;

    function reset() {
      setName('');
      setVisibility('team');
      setAccentColor('coral');
    }

    function submit(e: FormEvent) {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || createBoard.isPending) return;
      createBoard.mutate(
        { name: trimmed, visibility, accentColor },
        {
          onSuccess: (detail) => {
            reset();
            onClose();
            navigate(`/b/${detail.board.id}`);
          },
        },
      );
    }

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4"
        onClick={onClose}
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={submit}
          className="w-full max-w-md rounded-lg border border-sand bg-paper p-6"
        >
          <h2 className="text-lg font-semibold text-ink">New board</h2>

          <label htmlFor="board-name" className="mt-4 block text-sm font-medium text-rust">
            Board name
          </label>
          <input
            id="board-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product Roadmap"
            className="mt-1 w-full rounded-md border border-sand bg-cream px-3 py-2 text-ink outline-none focus:border-coral"
          />

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-rust">Visibility</legend>
            <div className="mt-1 flex gap-2">
              {(['team', 'private'] as Visibility[]).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setVisibility(v)}
                  aria-pressed={visibility === v}
                  className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                    visibility === v ? 'border-coral bg-coral/10 text-coral' : 'border-sand text-latte'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-rust">Accent color</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={c}
                  aria-pressed={accentColor === c}
                  onClick={() => setAccentColor(c)}
                  style={{ backgroundColor: LABEL_HEX[c] }}
                  className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-paper ${
                    accentColor === c ? 'ring-ink' : 'ring-transparent'
                  }`}
                />
              ))}
            </div>
          </fieldset>

          {createBoard.isError && (
            <p className="mt-3 text-sm text-red-700">Could not create board. Try again.</p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-latte hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createBoard.isPending}
              className="rounded-md bg-coral px-4 py-2 font-medium text-paper hover:bg-rust disabled:opacity-50"
            >
              {createBoard.isPending ? 'Creating…' : 'Create board'}
            </button>
          </div>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/CreateBoardDialog.tsx
  git commit -m "feat(home): CreateBoardDialog with visibility + accent picker" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 9.5: SearchResults view

**Files:** `client/src/components/SearchResults.tsx`

- [ ] **Step 1: Create `client/src/components/SearchResults.tsx`.** Full file (lists `SearchResult`s, each linking to `/b/:boardId/c/:cardId`):
  ```tsx
  import { Link } from 'react-router';
  import { useSearch } from '../api/queries';

  export function SearchResults({ q }: { q: string }) {
    const { data, isLoading, isError } = useSearch(q);
    const results = data ?? [];

    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="text-lg font-semibold text-ink">Search results for “{q}”</h2>

        {isLoading && <p className="mt-4 text-latte">Searching…</p>}
        {isError && <p className="mt-4 text-red-700">Search failed. Try again.</p>}
        {!isLoading && !isError && results.length === 0 && (
          <p className="mt-4 text-latte">No cards match “{q}”.</p>
        )}

        <ul className="mt-4 space-y-2">
          {results.map((r) => (
            <li key={r.cardId}>
              <Link
                to={`/b/${r.boardId}/c/${r.cardId}`}
                className="block rounded-lg border border-sand bg-paper p-3 hover:border-latte"
              >
                <div className="font-medium text-ink">{r.title}</div>
                <div className="mt-0.5 text-xs text-latte">
                  {r.boardName} · {r.listName}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/SearchResults.tsx
  git commit -m "feat(home): search results view linking to card deep-links" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 9.6: HomePage assembly + integration test (TDD)

**Files:** `client/src/pages/HomePage.tsx` (replace Section 8 stub), `client/src/pages/HomePage.test.tsx`

- [ ] **Step 1: Write the failing integration test `client/src/pages/HomePage.test.tsx`.** Full file (mocks the `api` fetch wrapper, renders `HomePage` under a real `QueryClientProvider` + `MemoryRouter`):
  ```tsx
  import { render, screen } from '@testing-library/react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { MemoryRouter } from 'react-router';
  import { vi, describe, it, expect, beforeEach } from 'vitest';
  import { HomePage } from './HomePage';
  import type { BoardSummary } from '@shared/types';

  const apiMock = vi.fn();
  vi.mock('../api/client', () => ({
    api: (path: string, opts?: RequestInit) => apiMock(path, opts),
    ApiError: class extends Error {},
  }));

  function board(over: Partial<BoardSummary>): BoardSummary {
    return {
      id: 'b',
      name: 'B',
      accentColor: 'coral',
      visibility: 'team',
      starred: false,
      cardCount: 0,
      memberCount: 1,
      archivedAt: null,
      ...over,
    };
  }

  function renderHome(boards: BoardSummary[]) {
    apiMock.mockImplementation((path: string) =>
      path === '/boards' ? Promise.resolve(boards) : Promise.resolve([]),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/']}>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  describe('HomePage', () => {
    beforeEach(() => apiMock.mockReset());

    it('shows the empty state when there are no boards', async () => {
      renderHome([]);
      expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create your first board/i }),
      ).toBeInTheDocument();
    });

    it('groups boards into Starred, Team, and Private sections', async () => {
      renderHome([
        board({ id: 's1', name: 'Alpha', visibility: 'team', starred: true }),
        board({ id: 't1', name: 'Beta', visibility: 'team' }),
        board({ id: 'p1', name: 'Gamma', visibility: 'private' }),
      ]);
      expect(await screen.findByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Starred')).toBeInTheDocument();
      expect(screen.getByText('Team boards')).toBeInTheDocument();
      expect(screen.getByText('Private boards')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Gamma')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ new board/i })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.** `npm test -w client -- HomePage`
  - Expected: FAIL — the Section 8 `HomePage` stub renders neither the empty state nor the grouped sections, so both `findByText` calls time out. `Tests 2 failed (2)`.

- [ ] **Step 3: Replace `client/src/pages/HomePage.tsx` with the full page.** Full file:
  ```tsx
  import { useState, type ReactNode } from 'react';
  import { useNavigate, useSearchParams } from 'react-router';
  import type { BoardSummary } from '@shared/types';
  import { useBoards, useToggleStar } from '../api/queries';
  import { groupBoards } from '../lib/groupBoards';
  import { BoardTile, NewBoardTile } from '../components/BoardTile';
  import { CreateBoardDialog } from '../components/CreateBoardDialog';
  import { SearchResults } from '../components/SearchResults';

  function BoardSection({ title, children }: { title: string; children: ReactNode }) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-latte">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </section>
    );
  }

  export function HomePage() {
    const [searchParams] = useSearchParams();
    const q = (searchParams.get('q') ?? '').trim();
    const boardsQuery = useBoards();
    const toggleStar = useToggleStar();
    const navigate = useNavigate();
    const [dialogOpen, setDialogOpen] = useState(false);

    if (q) return <SearchResults q={q} />;

    const boards = boardsQuery.data ?? [];
    const groups = groupBoards(boards);
    const open = (id: string) => navigate(`/b/${id}`);
    const star = (b: BoardSummary) => toggleStar.mutate({ boardId: b.id, starred: !b.starred });

    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        {boardsQuery.isLoading && <p className="text-latte">Loading boards…</p>}

        {!boardsQuery.isLoading && boards.length === 0 && (
          <div className="rounded-lg border border-sand bg-paper p-10 text-center">
            <h2 className="text-xl font-semibold text-ink">No boards yet</h2>
            <p className="mt-2 text-latte">Create your first board to start organizing work.</p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-6 rounded-md bg-coral px-4 py-2 font-medium text-paper hover:bg-rust"
            >
              Create your first board
            </button>
          </div>
        )}

        {!boardsQuery.isLoading && boards.length > 0 && (
          <>
            {groups.starred.length > 0 && (
              <BoardSection title="Starred">
                {groups.starred.map((b) => (
                  <BoardTile key={b.id} board={b} onOpen={() => open(b.id)} onToggleStar={() => star(b)} />
                ))}
              </BoardSection>
            )}

            <BoardSection title="Team boards">
              <NewBoardTile onClick={() => setDialogOpen(true)} />
              {groups.team.map((b) => (
                <BoardTile key={b.id} board={b} onOpen={() => open(b.id)} onToggleStar={() => star(b)} />
              ))}
            </BoardSection>

            {groups.private.length > 0 && (
              <BoardSection title="Private boards">
                {groups.private.map((b) => (
                  <BoardTile key={b.id} board={b} onOpen={() => open(b.id)} onToggleStar={() => star(b)} />
                ))}
              </BoardSection>
            )}
          </>
        )}

        <CreateBoardDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </div>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect pass.** `npm test -w client -- HomePage`
  - Expected: `Test Files 1 passed (1)` · `Tests 2 passed (2)`.

- [ ] **Step 5: Typecheck + build the whole client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` reports no type errors; Vite prints `✓ built in …` and writes `client/dist`.

- [ ] **Step 6: Run the full client suite — expect pass.** `npm test -w client`
  - Expected: all client test files pass, including this section's `groupBoards` (2) and `HomePage` (2) alongside Section 8's client tests; overall `Test Files … passed`, exit 0.

- [ ] **Step 7: Manual verification in a real browser.** Start `npm run dev`; log in as the seeded admin (Sections 3/8). On `/`:
  - With no boards: the "No boards yet" card shows with a **Create your first board** button. Click it → the New board dialog opens.
  - In the dialog: type a name, leave visibility on **team** (highlighted), click a different accent swatch (its ring highlights), click **Create board** → the dialog closes and the URL changes to `/b/<id>` (the board page itself is Section 10; a stub/loading view is expected here).
  - Return to `/`: the new board appears in **Team boards** as a paper tile with a colored top strip matching the chosen accent, its name, and "0 cards · 1 member". A dashed **+ New board** tile sits first in that section.
  - Click the tile's ☆ → it fills to ★ (amber) after the boards list refetches; the board also moves into a **Starred** section on the next render.
  - Visit `/?q=<a word in a card title>` directly → the search results view lists matching cards as `boardName · listName` rows; clicking a row navigates to `/b/:boardId/c/:cardId`. (Requires at least one card to exist; card creation is Sections 5/10.)
  - Stop with Ctrl-C.

- [ ] **Step 8: Commit.**
  ```
  git add client/src/pages/HomePage.tsx client/src/pages/HomePage.test.tsx
  git commit -m "feat(home): HomePage board grid, sections, empty state, search view" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Section verification (all must hold before section 10)

- [ ] `npm test -w client -- groupBoards` → `Tests 2 passed (2)`.
- [ ] `npm test -w client -- HomePage` → `Tests 2 passed (2)`.
- [ ] `npm test -w client` → all client test files pass (Section 8 + Section 9), exit 0.
- [ ] `npm run build -w client` → `tsc -b` clean, `client/dist` produced.
- [ ] Manual: empty state → create dialog → create navigates to `/b/:id`; new board tile shows accent strip + counts; star toggles and re-groups into Starred; `/?q=` renders search results linking to `/b/:boardId/c/:cardId`.


---

## Section 10: Client board page: columns, drag-and-drop, live sync, board menu

Builds the authenticated board page (`/b/:boardId`): the `BoardPage` shell that loads `useBoard` + `useBoardChannel` (thin "reconnecting…" banner while the socket is down, with all mutations and drag disabled); a `BoardHeader` (inline board rename, star toggle, member avatars ringed when the member is currently present, and a `BoardMenu` for visibility, members add/remove, an archived-items dialog with restore, and archive-board); a horizontal row of dnd-kit-sortable `ListColumn`s (each with inline rename, live card count, archive, a vertical dnd-kit `SortableContext` of `CardTile`s, and a bottom `CardComposer`); an add-list composer at the row end; and `CardTile` (label strips via `LABEL_HEX`, title, due chip that turns red when overdue vs local today, checklist `x/y`, comment/attachment counts, assignee avatars). Drag-and-drop uses `@dnd-kit/core` + `@dnd-kit/sortable`: cards sortable within/between columns and lists sortable horizontally; `onDragEnd` computes the destination index, calls the **pure** optimistic-move updater (which computes `positionBetween(prev, next)` via the client `lib/position.ts`), writes the TanStack cache optimistically, then PATCHes; on error it invalidates the board query and toasts.

### Depends on (lower-numbered sections — assumed artifacts)

Execution runs in order, so Sections 1–9 are done. §10 consumes these **stable** surfaces verbatim:

- **`client/src/api/client.ts`** — `api<T>(path, opts?)`: `fetch` wrapper that prepends `/api` to `path`, sets `credentials: 'include'`, JSON-encodes/`Content-Type`s a string body, and throws `ApiError{status,message}` on non-2xx. **Paths passed to `api()` do NOT include the `/api` prefix** (e.g. `api('/boards/x')` → `GET /api/boards/x`). All §10 hooks follow this.
- **`client/src/api/queries.ts`** — exports `qk` (`qk.board(id)` → `['board', id]`, `qk.boards` → `['boards']`), `useBoard(boardId)` → `UseQueryResult<BoardDetail>`, `useMe()` → `UseQueryResult<Me>`, and already imports `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query` and `api` from `./client`. §10 **appends** board-page hooks to this file and reuses `qk`.
- **`client/src/api/socket.ts`** — `useBoardChannel(boardId)` → `{ connected: boolean; presence: { id: string; name: string; avatarColor: string }[] }`. Joins/leaves room, invalidates `qk.board(boardId)` on `board:changed` (debounced) and on reconnect. §10 reads `connected` (banner + disable) and `presence` (avatar highlight).
- **`client/src/components/ui/`** — `Button`, `Input`, `Avatar({name,color,size?})`, `Dialog({open,onClose,title?,children})`, `Menu({trigger,items:{label,onSelect,danger?}[]})`, `useToast()` → `(message:string)=>void` (its `ToastProvider` wraps the app in `App.tsx`).
- **`client/src/App.tsx`** — imports `{ BoardPage }` (a **named** export) from `./pages/BoardPage` and routes `/b/:boardId` and `/b/:boardId/c/:cardId` to it. §10 **replaces** the §8 placeholder `BoardPage.tsx` keeping the `export function BoardPage()` **named** export, so no `App.tsx` edit is needed.
- **Router package is `react-router` v7**; `useParams`, `useNavigate`, `Link` import from `react-router`.
- Server routes used all exist by now: `GET/PATCH/DELETE /api/boards/:id`, `POST /api/boards/:id/star|members|lists`, `DELETE /api/boards/:id/members/:userId`, `GET /api/boards/:id/archived`, `POST /api/boards/:id/restore`, `PATCH/DELETE /api/lists/:id`, `POST /api/lists/:id/cards`, `PATCH /api/cards/:id`, `GET /api/admin/members` (§4/§5/§7).

Consumed types from `@shared/types` (never redefined): `BoardDetail`, `BoardSummary`, `ListDto`, `CardDto`, `Label`, `UserPublic`, `Visibility`, `LabelColor`, `Id`, and the `LABEL_HEX` const.

### Boundary decisions (kept explicit so the executor doesn't invent work)

- **Card-detail modal is §11.** The route `/b/:boardId/c/:cardId` already renders `BoardPage`; §10's `BoardPage` shows the board and a click on a card **navigates** to that URL but renders no overlay. §11 edits `BoardPage.tsx` to overlay `<CardDetail>` when a `:cardId` param is present. §10 therefore never imports `CardDetail`.
- **Member management is admin-gated.** The contract's only user-roster endpoint is `GET /api/admin/members` (admin). So the `BoardMenu` "Members…" item (add candidates from the roster + remove) is shown only when `me.isAdmin`; non-admins still see who's on the board via the header avatars. `useDirectory()` parses the roster defensively (`UserPublic[]` or `{members:UserPublic[]}`) so it stays correct whichever shape §7 returns.
- The star toggle in the header updates the **board detail** (`qk.board`) plus the boards list (`qk.boards`); this is a distinct hook from §9's `useToggleStar` (which only touches `qk.boards`).

### Files

**Create**
- `client/src/lib/position.ts` — `positionBetween(a, b)` (fractional-indexing, no client jitter)
- `client/src/lib/position.test.ts`
- `client/src/lib/date.ts` — `todayLocalISO()`, `isOverdue(dueDate, today)`
- `client/src/lib/date.test.ts`
- `client/src/lib/boardMoves.ts` — pure `moveCard`, `moveList`, `sortByPosition` optimistic updaters
- `client/src/lib/boardMoves.test.ts`
- `client/src/components/board/CardComposer.tsx`
- `client/src/components/board/CardTile.tsx`
- `client/src/components/board/ListColumn.tsx`
- `client/src/components/board/BoardMenu.tsx`
- `client/src/components/board/BoardHeader.tsx`

**Modify**
- `client/package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fractional-indexing`
- `client/src/api/queries.ts` — append board-page query/mutation hooks
- `client/src/pages/BoardPage.tsx` — replace §8 placeholder with the full board page (keep the `BoardPage` named export)

**Test**
- `client/src/lib/position.test.ts`, `client/src/lib/date.test.ts`, `client/src/lib/boardMoves.test.ts`

---

### Task 10.1: dnd-kit + fractional-indexing deps and client `position.ts` (TDD)

**Files:** `client/package.json`, `client/src/lib/position.ts`, `client/src/lib/position.test.ts`

- [ ] **Step 1: Add the drag/position deps.** In `client/package.json`, replace the `"dependencies"` block (the exact §8 block):
  ```json
      "dependencies": {
        "@tanstack/react-query": "^5.62.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-router": "^7.1.0",
        "socket.io-client": "^4.8.0"
      },
  ```
  with:
  ```json
      "dependencies": {
        "@dnd-kit/core": "^6.3.1",
        "@dnd-kit/sortable": "^10.0.0",
        "@dnd-kit/utilities": "^3.2.2",
        "@tanstack/react-query": "^5.62.0",
        "fractional-indexing": "^3.2.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "react-router": "^7.1.0",
        "socket.io-client": "^4.8.0"
      },
  ```

- [ ] **Step 2: Install.** Run `npm install` (from repo root).
  - Expected: `added N packages` including `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `fractional-indexing`; exit 0, no errors.

- [ ] **Step 3: Write the failing test** `client/src/lib/position.test.ts` (property-based so it is robust to the library's exact key format):
  ```ts
  import { describe, it, expect } from 'vitest';
  import { positionBetween } from './position';

  describe('positionBetween', () => {
    it('returns a non-empty first key for (null, null)', () => {
      const k = positionBetween(null, null);
      expect(typeof k).toBe('string');
      expect(k.length).toBeGreaterThan(0);
    });

    it('appends after a key when the right bound is null', () => {
      const a = positionBetween(null, null);
      const after = positionBetween(a, null);
      expect(a < after).toBe(true);
    });

    it('prepends before a key when the left bound is null', () => {
      const a = positionBetween(null, null);
      const before = positionBetween(null, a);
      expect(before < a).toBe(true);
    });

    it('returns a key that sorts strictly between two adjacent keys', () => {
      const a = positionBetween(null, null);
      const b = positionBetween(a, null);
      const mid = positionBetween(a, b);
      expect(a < mid).toBe(true);
      expect(mid < b).toBe(true);
    });
  });
  ```

- [ ] **Step 4: Run it — expect failure.** `npm test -w client -- lib/position`
  - Expected: FAIL — `Failed to load url ./position` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 5: Implement** `client/src/lib/position.ts` (full file):
  ```ts
  import { generateKeyBetween } from 'fractional-indexing';

  export function positionBetween(a: string | null, b: string | null): string {
    return generateKeyBetween(a, b);
  }
  ```

- [ ] **Step 6: Run it — expect pass.** `npm test -w client -- lib/position`
  - Expected: `Test Files 1 passed (1)` · `Tests 4 passed (4)`.

- [ ] **Step 7: Commit.**
  ```
  git add client/package.json package-lock.json client/src/lib/position.ts client/src/lib/position.test.ts
  git commit -m "feat(board): dnd-kit deps + client positionBetween helper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.2: Due-date helpers `date.ts` (TDD)

**Files:** `client/src/lib/date.ts`, `client/src/lib/date.test.ts`

- [ ] **Step 1: Write the failing test** `client/src/lib/date.test.ts` (full file):
  ```ts
  import { describe, it, expect } from 'vitest';
  import { todayLocalISO, isOverdue } from './date';

  describe('todayLocalISO', () => {
    it('formats a Date as zero-padded local YYYY-MM-DD', () => {
      expect(todayLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(todayLocalISO(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
  });

  describe('isOverdue', () => {
    it('is true only when a due date is strictly before today', () => {
      expect(isOverdue('2026-07-13', '2026-07-14')).toBe(true);
      expect(isOverdue('2026-07-14', '2026-07-14')).toBe(false);
      expect(isOverdue('2026-07-15', '2026-07-14')).toBe(false);
    });

    it('is false when there is no due date', () => {
      expect(isOverdue(null, '2026-07-14')).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run it — expect failure.** `npm test -w client -- lib/date`
  - Expected: FAIL — `Failed to load url ./date` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement** `client/src/lib/date.ts` (full file):
  ```ts
  export function todayLocalISO(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  export function isOverdue(dueDate: string | null, today: string): boolean {
    return dueDate !== null && dueDate < today;
  }
  ```

- [ ] **Step 4: Run it — expect pass.** `npm test -w client -- lib/date`
  - Expected: `Test Files 1 passed (1)` · `Tests 3 passed (3)`.

- [ ] **Step 5: Commit.**
  ```
  git add client/src/lib/date.ts client/src/lib/date.test.ts
  git commit -m "feat(board): local-today + isOverdue date helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.3: Pure optimistic-move updater `boardMoves.ts` (TDD)

The card/list drag reducers are the one piece of non-trivial client logic in this section, so they are extracted as pure functions and unit-tested per the contract. `moveCard`/`moveList` take the current `BoardDetail` plus a destination `{ listId/id, toIndex }` and return a **new** `BoardDetail` with the moved item's `position` recomputed from its new neighbors via `positionBetween`. `sortByPosition` reproduces the server's `(position, id)` ordering so client and server agree.

**Files:** `client/src/lib/boardMoves.ts`, `client/src/lib/boardMoves.test.ts`

- [ ] **Step 1: Write the failing test** `client/src/lib/boardMoves.test.ts` (full file — positions are generated with the real `positionBetween` so the fixture is internally consistent):
  ```ts
  import { describe, it, expect } from 'vitest';
  import type { BoardDetail, CardDto, ListDto } from '@shared/types';
  import { positionBetween } from './position';
  import { moveCard, moveList, sortByPosition } from './boardMoves';

  const p1 = positionBetween(null, null);
  const p2 = positionBetween(p1, null);
  const p3 = positionBetween(p2, null);

  function card(over: Partial<CardDto>): CardDto {
    return {
      id: 'c',
      listId: 'A',
      boardId: 'b',
      title: 'C',
      description: '',
      dueDate: null,
      position: p1,
      archivedAt: null,
      createdBy: 'u',
      createdAt: '2026-07-14T00:00:00.000Z',
      updatedAt: '2026-07-14T00:00:00.000Z',
      assigneeIds: [],
      labelIds: [],
      checklist: [],
      attachmentCount: 0,
      commentCount: 0,
      ...over,
    };
  }

  function list(over: Partial<ListDto>): ListDto {
    return { id: 'A', boardId: 'b', name: 'A', position: p1, archivedAt: null, ...over };
  }

  function board(lists: ListDto[], cards: CardDto[]): BoardDetail {
    return {
      board: {
        id: 'b',
        name: 'B',
        accentColor: 'coral',
        visibility: 'team',
        starred: false,
        cardCount: cards.length,
        memberCount: 1,
        archivedAt: null,
        members: [],
      },
      lists,
      cards,
      labels: [],
    };
  }

  describe('sortByPosition', () => {
    it('orders by position then breaks ties by id', () => {
      const sorted = sortByPosition([
        { id: 'z', position: p1 },
        { id: 'a', position: p1 },
        { id: 'm', position: p2 },
      ]);
      expect(sorted.map((x) => x.id)).toEqual(['a', 'z', 'm']);
    });
  });

  describe('moveCard', () => {
    const lists = [list({ id: 'A' }), list({ id: 'B', position: p2 })];

    it('moves a card into an empty list and reassigns its listId', () => {
      const cards = [card({ id: 'c1', listId: 'A', position: p1 })];
      const next = moveCard(board(lists, cards), { cardId: 'c1', toListId: 'B', toIndex: 0 });
      const moved = next.cards.find((c) => c.id === 'c1')!;
      expect(moved.listId).toBe('B');
      expect(next.cards.filter((c) => c.listId === 'B')).toHaveLength(1);
    });

    it('inserts between two cards with a position that sorts between them', () => {
      const cards = [
        card({ id: 'c1', listId: 'B', position: p1 }),
        card({ id: 'c2', listId: 'B', position: p2 }),
        card({ id: 'x', listId: 'A', position: p1 }),
      ];
      const next = moveCard(board(lists, cards), { cardId: 'x', toListId: 'B', toIndex: 1 });
      const moved = next.cards.find((c) => c.id === 'x')!;
      expect(moved.listId).toBe('B');
      expect(p1 < moved.position).toBe(true);
      expect(moved.position < p2).toBe(true);
    });

    it('ignores archived cards when computing destination neighbors', () => {
      const cards = [
        card({ id: 'c1', listId: 'B', position: p1 }),
        card({ id: 'gone', listId: 'B', position: p2, archivedAt: '2026-07-14T00:00:00.000Z' }),
        card({ id: 'x', listId: 'A', position: p3 }),
      ];
      const next = moveCard(board(lists, cards), { cardId: 'x', toListId: 'B', toIndex: 1 });
      const moved = next.cards.find((c) => c.id === 'x')!;
      expect(p1 < moved.position).toBe(true);
    });

    it('returns the same board object for an unknown card id', () => {
      const b = board(lists, [card({ id: 'c1' })]);
      expect(moveCard(b, { cardId: 'nope', toListId: 'B', toIndex: 0 })).toBe(b);
    });
  });

  describe('moveList', () => {
    it('reorders a list so it sorts between its new neighbors', () => {
      const lists = [
        list({ id: 'A', position: p1 }),
        list({ id: 'B', position: p2 }),
        list({ id: 'C', position: p3 }),
      ];
      const next = moveList(board(lists, []), { listId: 'C', toIndex: 1 });
      const moved = next.lists.find((l) => l.id === 'C')!;
      expect(p1 < moved.position).toBe(true);
      expect(moved.position < p2).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run it — expect failure.** `npm test -w client -- lib/boardMoves`
  - Expected: FAIL — `Failed to load url ./boardMoves` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement** `client/src/lib/boardMoves.ts` (full file):
  ```ts
  import type { BoardDetail, Id } from '@shared/types';
  import { positionBetween } from './position';

  export interface CardMove {
    cardId: Id;
    toListId: Id;
    toIndex: number;
  }

  export interface ListMove {
    listId: Id;
    toIndex: number;
  }

  export function sortByPosition<T extends { position: string; id: Id }>(items: T[]): T[] {
    return [...items].sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1,
    );
  }

  export function moveCard(board: BoardDetail, move: CardMove): BoardDetail {
    if (!board.cards.some((c) => c.id === move.cardId)) return board;
    const dest = sortByPosition(
      board.cards.filter(
        (c) => c.listId === move.toListId && c.id !== move.cardId && c.archivedAt === null,
      ),
    );
    const index = Math.max(0, Math.min(move.toIndex, dest.length));
    const prev = index > 0 ? dest[index - 1].position : null;
    const next = index < dest.length ? dest[index].position : null;
    const position = positionBetween(prev, next);
    return {
      ...board,
      cards: board.cards.map((c) =>
        c.id === move.cardId ? { ...c, listId: move.toListId, position } : c,
      ),
    };
  }

  export function moveList(board: BoardDetail, move: ListMove): BoardDetail {
    if (!board.lists.some((l) => l.id === move.listId)) return board;
    const dest = sortByPosition(
      board.lists.filter((l) => l.id !== move.listId && l.archivedAt === null),
    );
    const index = Math.max(0, Math.min(move.toIndex, dest.length));
    const prev = index > 0 ? dest[index - 1].position : null;
    const next = index < dest.length ? dest[index].position : null;
    const position = positionBetween(prev, next);
    return {
      ...board,
      lists: board.lists.map((l) => (l.id === move.listId ? { ...l, position } : l)),
    };
  }
  ```

- [ ] **Step 4: Run it — expect pass.** `npm test -w client -- lib/boardMoves`
  - Expected: `Test Files 1 passed (1)` · `Tests 6 passed (6)`.

- [ ] **Step 5: Commit.**
  ```
  git add client/src/lib/boardMoves.ts client/src/lib/boardMoves.test.ts
  git commit -m "feat(board): pure optimistic moveCard/moveList cache updaters" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.4: Board-page query/mutation hooks in `queries.ts`

**Files:** `client/src/api/queries.ts` (modify)

- [ ] **Step 1: Ensure the `@shared/types` type import covers §10's types.** At the top of `client/src/api/queries.ts` there is already a `import type { ... } from '@shared/types';` line (added by §8). Ensure its named list **includes** `BoardDetail`, `ListDto`, `CardDto`, `UserPublic`, `Visibility`, `LabelColor`, and `Id` (add any that are missing; leave existing names in place). `useQuery`, `useMutation`, `useQueryClient` (from `@tanstack/react-query`) and `api` (from `./client`) and `qk` are already in this file from §8 — do not re-import them.

- [ ] **Step 2: Append the board-page hooks block to the END of `client/src/api/queries.ts`.** Paste verbatim:
  ```ts
  // ---- Section 10: board page queries & mutations ----

  export interface ArchivedItems {
    lists: ListDto[];
    cards: CardDto[];
  }

  export function usePatchBoard(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: { name?: string; visibility?: Visibility; accentColor?: LabelColor }) =>
        api<void>(`/boards/${boardId}`, { method: 'PATCH', body: JSON.stringify(body) }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qk.board(boardId) });
        qc.invalidateQueries({ queryKey: qk.boards });
      },
    });
  }

  export function useSetBoardStar(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (starred: boolean) =>
        api<void>(`/boards/${boardId}/star`, { method: 'POST', body: JSON.stringify({ starred }) }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qk.board(boardId) });
        qc.invalidateQueries({ queryKey: qk.boards });
      },
    });
  }

  export function useArchiveBoard(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: () => api<void>(`/boards/${boardId}`, { method: 'DELETE' }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.boards }),
    });
  }

  export function useAddBoardMember(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (userId: Id) =>
        api<void>(`/boards/${boardId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useRemoveBoardMember(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (userId: Id) =>
        api<void>(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useCreateList(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (name: string) =>
        api<ListDto>(`/boards/${boardId}/lists`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function usePatchList(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { listId: Id; name?: string; position?: string }) =>
        api<void>(`/lists/${input.listId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: input.name, position: input.position }),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useArchiveList(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (listId: Id) => api<void>(`/lists/${listId}`, { method: 'DELETE' }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useCreateCard(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { listId: Id; title: string }) =>
        api<CardDto>(`/lists/${input.listId}/cards`, {
          method: 'POST',
          body: JSON.stringify({ title: input.title }),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useMoveCard(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: Id; listId: Id; position: string }) =>
        api<void>(`/cards/${input.cardId}`, {
          method: 'PATCH',
          body: JSON.stringify({ listId: input.listId, position: input.position }),
        }),
      onError: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useMoveList(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { listId: Id; position: string }) =>
        api<void>(`/lists/${input.listId}`, {
          method: 'PATCH',
          body: JSON.stringify({ position: input.position }),
        }),
      onError: () => qc.invalidateQueries({ queryKey: qk.board(boardId) }),
    });
  }

  export function useArchivedItems(boardId: Id, enabled: boolean) {
    return useQuery({
      queryKey: ['board', boardId, 'archived'] as const,
      queryFn: () => api<ArchivedItems>(`/boards/${boardId}/archived`),
      enabled,
    });
  }

  export function useRestoreArchived(boardId: Id) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { entity: 'list' | 'card'; id: Id }) =>
        api<void>(`/boards/${boardId}/restore`, { method: 'POST', body: JSON.stringify(input) }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qk.board(boardId) });
        qc.invalidateQueries({ queryKey: ['board', boardId, 'archived'] });
      },
    });
  }

  export function useDirectory() {
    return useQuery({
      queryKey: ['directory'] as const,
      queryFn: async () => {
        const res = await api<{ members: UserPublic[] } | UserPublic[]>('/admin/members');
        return Array.isArray(res) ? res : res.members;
      },
    });
  }
  ```

- [ ] **Step 3: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` reports no type errors (the new hooks are exported but not yet consumed — `noUnusedLocals` does not flag exports), then Vite prints `✓ built in …`. Exit 0.

- [ ] **Step 4: Commit.**
  ```
  git add client/src/api/queries.ts
  git commit -m "feat(board): board/list/card query + mutation hooks" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.5: `CardComposer` + `CardTile`

Presentational components (verified by the build in Task 10.9 and by E2E in §12, per the contract's testing conventions — no unit tests).

**Files:** `client/src/components/board/CardComposer.tsx`, `client/src/components/board/CardTile.tsx`

- [ ] **Step 1: Create** `client/src/components/board/CardComposer.tsx` (full file — collapses to a "+ Add a card" button; opens a textarea; Enter adds and keeps the composer open for rapid entry, Esc closes):
  ```tsx
  import { useState } from 'react';

  export function CardComposer({
    onAdd,
    disabled,
  }: {
    onAdd: (title: string) => void;
    disabled: boolean;
  }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');

    const submit = () => {
      const trimmed = title.trim();
      if (!trimmed) return;
      onAdd(trimmed);
      setTitle('');
    };

    if (!open) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="rounded-lg px-2 py-1.5 text-left text-sm text-latte hover:bg-sand/40 disabled:opacity-40"
        >
          + Add a card
        </button>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') {
              setOpen(false);
              setTitle('');
            }
          }}
          placeholder="Card title…"
          rows={2}
          className="w-full resize-none rounded-lg border border-sand bg-paper p-2 text-sm text-ink outline-none focus:border-coral"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !title.trim()}
            className="rounded-md bg-coral px-3 py-1 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTitle('');
            }}
            className="rounded-md px-2 py-1 text-sm text-latte hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create** `client/src/components/board/CardTile.tsx` (full file — dnd-kit sortable; label strips, title, due chip red when overdue, checklist `x/y`, comment/attachment counts, assignee avatars; click opens the card):
  ```tsx
  import { useSortable } from '@dnd-kit/sortable';
  import { CSS } from '@dnd-kit/utilities';
  import { LABEL_HEX, type CardDto, type Label, type UserPublic, type Id } from '@shared/types';
  import { Avatar } from '../ui/Avatar';
  import { isOverdue } from '../../lib/date';

  function formatDue(dueDate: string): string {
    return new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  export function CardTile({
    card,
    labelById,
    memberById,
    today,
    onOpen,
    disabled,
  }: {
    card: CardDto;
    labelById: Map<Id, Label>;
    memberById: Map<Id, UserPublic>;
    today: string;
    onOpen: () => void;
    disabled: boolean;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: `card:${card.id}`,
      data: { type: 'card', cardId: card.id, listId: card.listId },
      disabled,
    });

    const labels = card.labelIds.map((id) => labelById.get(id)).filter((l): l is Label => !!l);
    const assignees = card.assigneeIds
      .map((id) => memberById.get(id))
      .filter((u): u is UserPublic => !!u);
    const doneCount = card.checklist.filter((i) => i.done).length;
    const overdue = isOverdue(card.dueDate, today);

    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
        }}
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className="cursor-pointer rounded-lg border border-sand bg-paper p-2.5 hover:border-latte"
      >
        {labels.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {labels.map((l) => (
              <span
                key={l.id}
                className="h-1.5 w-8 rounded-full"
                style={{ backgroundColor: LABEL_HEX[l.color] }}
                title={l.name}
              />
            ))}
          </div>
        )}

        <p className="text-sm text-ink">{card.title}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-latte">
          {card.dueDate && (
            <span
              className={`rounded px-1.5 py-0.5 ${
                overdue ? 'bg-red-100 text-red-800' : 'bg-sand/60 text-rust'
              }`}
            >
              {formatDue(card.dueDate)}
            </span>
          )}
          {card.checklist.length > 0 && (
            <span aria-label="checklist progress">
              ✓ {doneCount}/{card.checklist.length}
            </span>
          )}
          {card.commentCount > 0 && <span aria-label="comment count">💬 {card.commentCount}</span>}
          {card.attachmentCount > 0 && (
            <span aria-label="attachment count">📎 {card.attachmentCount}</span>
          )}
          {assignees.length > 0 && (
            <span className="ml-auto flex -space-x-1">
              {assignees.map((u) => (
                <Avatar key={u.id} name={u.name} color={u.avatarColor} size={20} />
              ))}
            </span>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`. Exit 0.

- [ ] **Step 4: Commit.**
  ```
  git add client/src/components/board/CardComposer.tsx client/src/components/board/CardTile.tsx
  git commit -m "feat(board): CardComposer + CardTile (labels, due chip, counts, assignees)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.6: `ListColumn` (sortable column, inline rename, count, archive, card list + composer)

Presentational (built/E2E-verified, no unit test). The column is a horizontal sortable item; its **title** is the drag handle (a plain click renames, a drag past the 5px threshold reorders). Cards render inside a vertical `SortableContext`; the card area is a droppable so a card can be dropped into an empty column or at the end.

**Files:** `client/src/components/board/ListColumn.tsx`

- [ ] **Step 1: Create** `client/src/components/board/ListColumn.tsx` (full file):
  ```tsx
  import { useState } from 'react';
  import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
  import { useDroppable } from '@dnd-kit/core';
  import { CSS } from '@dnd-kit/utilities';
  import type { CardDto, ListDto, Label, UserPublic, Id } from '@shared/types';
  import { CardTile } from './CardTile';
  import { CardComposer } from './CardComposer';
  import { usePatchList, useArchiveList, useCreateCard } from '../../api/queries';

  export function ListColumn({
    boardId,
    list,
    cards,
    labelById,
    memberById,
    today,
    disabled,
    onOpenCard,
  }: {
    boardId: Id;
    list: ListDto;
    cards: CardDto[];
    labelById: Map<Id, Label>;
    memberById: Map<Id, UserPublic>;
    today: string;
    disabled: boolean;
    onOpenCard: (cardId: Id) => void;
  }) {
    const patchList = usePatchList(boardId);
    const archiveList = useArchiveList(boardId);
    const createCard = useCreateCard(boardId);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(list.name);

    const sortable = useSortable({
      id: `list:${list.id}`,
      data: { type: 'list', listId: list.id },
      disabled,
    });
    const droppable = useDroppable({ id: `column:${list.id}`, data: { type: 'column', listId: list.id } });

    const commitName = () => {
      setEditing(false);
      const trimmed = name.trim();
      if (trimmed && trimmed !== list.name) patchList.mutate({ listId: list.id, name: trimmed });
      else setName(list.name);
    };

    return (
      <div
        ref={sortable.setNodeRef}
        style={{
          transform: CSS.Translate.toString(sortable.transform),
          transition: sortable.transition,
        }}
        className="flex max-h-full w-72 shrink-0 flex-col rounded-lg border border-sand bg-cream/60"
      >
        <div className="flex items-center gap-2 p-2">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  setName(list.name);
                  setEditing(false);
                }
              }}
              className="w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
            />
          ) : (
            <button
              ref={sortable.setActivatorNodeRef}
              {...sortable.attributes}
              {...sortable.listeners}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  setName(list.name);
                  setEditing(true);
                }
              }}
              className="flex-1 cursor-grab text-left text-sm font-semibold text-ink"
            >
              {list.name || 'Untitled'}
            </button>
          )}
          <span className="text-xs text-latte">{cards.length}</span>
          <button
            type="button"
            aria-label="Archive list"
            disabled={disabled}
            onClick={() => {
              if (!disabled) archiveList.mutate(list.id);
            }}
            className="text-latte hover:text-rust disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div ref={droppable.setNodeRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          <SortableContext
            items={cards.map((c) => `card:${c.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                labelById={labelById}
                memberById={memberById}
                today={today}
                disabled={disabled}
                onOpen={() => onOpenCard(c.id)}
              />
            ))}
          </SortableContext>
          <CardComposer disabled={disabled} onAdd={(title) => createCard.mutate({ listId: list.id, title })} />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`. Exit 0.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/board/ListColumn.tsx
  git commit -m "feat(board): ListColumn (sortable, rename, count, archive, card composer)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.7: `BoardMenu` (visibility, members dialog, archived-items dialog, archive board)

Presentational (built/E2E-verified, no unit test). Reuses §8's `Menu`, `Dialog`, `Avatar`. Top-level menu items: toggle visibility, Members… (admin only — see boundary decision), Archived items…, and Archive board (danger, `window.confirm` then navigate home).

**Files:** `client/src/components/board/BoardMenu.tsx`

- [ ] **Step 1: Create** `client/src/components/board/BoardMenu.tsx` (full file):
  ```tsx
  import { useState } from 'react';
  import { useNavigate } from 'react-router';
  import type { BoardSummary, UserPublic, Id } from '@shared/types';
  import { Menu, type MenuItem } from '../ui/Menu';
  import { Dialog } from '../ui/Dialog';
  import { Avatar } from '../ui/Avatar';
  import {
    usePatchBoard,
    useArchiveBoard,
    useAddBoardMember,
    useRemoveBoardMember,
    useDirectory,
    useArchivedItems,
    useRestoreArchived,
  } from '../../api/queries';

  export function BoardMenu({
    boardId,
    board,
    members,
    isAdmin,
  }: {
    boardId: Id;
    board: BoardSummary;
    members: UserPublic[];
    isAdmin: boolean;
  }) {
    const navigate = useNavigate();
    const patchBoard = usePatchBoard(boardId);
    const archiveBoard = useArchiveBoard(boardId);
    const [membersOpen, setMembersOpen] = useState(false);
    const [archivedOpen, setArchivedOpen] = useState(false);

    const items: MenuItem[] = [
      {
        label: board.visibility === 'team' ? 'Make private' : 'Make team',
        onSelect: () =>
          patchBoard.mutate({ visibility: board.visibility === 'team' ? 'private' : 'team' }),
      },
      ...(isAdmin ? [{ label: 'Members…', onSelect: () => setMembersOpen(true) }] : []),
      { label: 'Archived items…', onSelect: () => setArchivedOpen(true) },
      {
        label: 'Archive board',
        danger: true,
        onSelect: () => {
          if (window.confirm('Archive this board? You can restore it from Admin.')) {
            archiveBoard.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) });
          }
        },
      },
    ];

    return (
      <>
        <Menu
          trigger={
            <span className="rounded-md px-2 py-1 text-lg leading-none text-latte hover:text-rust">
              ⋯
            </span>
          }
          items={items}
        />
        {membersOpen && (
          <MembersDialog boardId={boardId} members={members} onClose={() => setMembersOpen(false)} />
        )}
        {archivedOpen && <ArchivedDialog boardId={boardId} onClose={() => setArchivedOpen(false)} />}
      </>
    );
  }

  function MembersDialog({
    boardId,
    members,
    onClose,
  }: {
    boardId: Id;
    members: UserPublic[];
    onClose: () => void;
  }) {
    const directory = useDirectory();
    const addMember = useAddBoardMember(boardId);
    const removeMember = useRemoveBoardMember(boardId);
    const memberIds = new Set(members.map((m) => m.id));
    const candidates = (directory.data ?? []).filter((u) => !memberIds.has(u.id) && !u.deactivated);

    return (
      <Dialog open onClose={onClose} title="Board members">
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <Avatar name={m.name} color={m.avatarColor} size={24} />
              <span className="flex-1 text-sm text-ink">{m.name}</span>
              <button
                type="button"
                onClick={() => removeMember.mutate(m.id)}
                className="text-xs text-red-700 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-sand pt-4">
          <p className="mb-2 text-sm font-medium text-rust">Add member</p>
          {directory.isLoading && <p className="text-sm text-latte">Loading…</p>}
          <ul className="flex flex-col gap-2">
            {candidates.map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <Avatar name={u.name} color={u.avatarColor} size={24} />
                <span className="flex-1 text-sm text-ink">{u.name}</span>
                <button
                  type="button"
                  onClick={() => addMember.mutate(u.id)}
                  className="text-xs text-coral hover:underline"
                >
                  Add
                </button>
              </li>
            ))}
            {!directory.isLoading && candidates.length === 0 && (
              <li className="text-sm text-latte">Everyone is already a member.</li>
            )}
          </ul>
        </div>
      </Dialog>
    );
  }

  function ArchivedDialog({ boardId, onClose }: { boardId: Id; onClose: () => void }) {
    const archived = useArchivedItems(boardId, true);
    const restore = useRestoreArchived(boardId);
    const lists = archived.data?.lists ?? [];
    const cards = archived.data?.cards ?? [];

    return (
      <Dialog open onClose={onClose} title="Archived items">
        {archived.isLoading && <p className="text-sm text-latte">Loading…</p>}
        {!archived.isLoading && lists.length === 0 && cards.length === 0 && (
          <p className="text-sm text-latte">Nothing archived.</p>
        )}
        {lists.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-rust">Lists</p>
            <ul className="flex flex-col gap-2">
              {lists.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-ink">{l.name || 'Untitled'}</span>
                  <button
                    type="button"
                    onClick={() => restore.mutate({ entity: 'list', id: l.id })}
                    className="text-xs text-coral hover:underline"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {cards.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-rust">Cards</p>
            <ul className="flex flex-col gap-2">
              {cards.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-ink">{c.title}</span>
                  <button
                    type="button"
                    onClick={() => restore.mutate({ entity: 'card', id: c.id })}
                    className="text-xs text-coral hover:underline"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`. Exit 0.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/board/BoardMenu.tsx
  git commit -m "feat(board): BoardMenu (visibility, members, archived-items restore, archive)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.8: `BoardHeader` (inline rename, star, presence-highlighted avatars, menu)

Presentational (built/E2E-verified, no unit test). Member avatars get a coral ring when that member's id is in the presence set from `useBoardChannel`.

**Files:** `client/src/components/board/BoardHeader.tsx`

- [ ] **Step 1: Create** `client/src/components/board/BoardHeader.tsx` (full file):
  ```tsx
  import { useState } from 'react';
  import { Link } from 'react-router';
  import { LABEL_HEX, type BoardSummary, type UserPublic, type Id } from '@shared/types';
  import { Avatar } from '../ui/Avatar';
  import { BoardMenu } from './BoardMenu';
  import { usePatchBoard, useSetBoardStar } from '../../api/queries';

  export function BoardHeader({
    boardId,
    board,
    members,
    presentIds,
    isAdmin,
    disabled,
  }: {
    boardId: Id;
    board: BoardSummary;
    members: UserPublic[];
    presentIds: Set<Id>;
    isAdmin: boolean;
    disabled: boolean;
  }) {
    const patchBoard = usePatchBoard(boardId);
    const setStar = useSetBoardStar(boardId);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(board.name);

    const commit = () => {
      setEditing(false);
      const trimmed = name.trim();
      if (trimmed && trimmed !== board.name) patchBoard.mutate({ name: trimmed });
      else setName(board.name);
    };

    return (
      <div className="flex items-center gap-3 border-b border-sand bg-paper px-4 py-3">
        <Link to="/" className="text-latte hover:text-rust" aria-label="Back to boards">
          ←
        </Link>
        <span
          className="h-4 w-1.5 rounded-full"
          style={{ backgroundColor: LABEL_HEX[board.accentColor] }}
        />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setName(board.name);
                setEditing(false);
              }
            }}
            className="rounded border border-sand bg-paper px-2 py-1 text-lg font-semibold text-ink outline-none focus:border-coral"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setName(board.name);
              setEditing(true);
            }}
            className="text-lg font-semibold text-ink"
          >
            {board.name}
          </button>
        )}
        <button
          type="button"
          aria-label={board.starred ? 'Unstar board' : 'Star board'}
          aria-pressed={board.starred}
          disabled={disabled}
          onClick={() => setStar.mutate(!board.starred)}
          className="text-lg leading-none disabled:opacity-40"
          style={{ color: board.starred ? LABEL_HEX.amber : '#B8865B' }}
        >
          {board.starred ? '★' : '☆'}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {members.map((m) => (
              <span
                key={m.id}
                className={`inline-flex rounded-full ${
                  presentIds.has(m.id) ? 'ring-2 ring-coral' : ''
                }`}
                title={presentIds.has(m.id) ? `${m.name} (viewing)` : m.name}
              >
                <Avatar name={m.name} color={m.avatarColor} size={28} />
              </span>
            ))}
          </div>
          <BoardMenu boardId={boardId} board={board} members={members} isAdmin={isAdmin} />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`. Exit 0.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/board/BoardHeader.tsx
  git commit -m "feat(board): BoardHeader (inline rename, star, presence avatars, menu)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 10.9: `BoardPage` assembly (DndContext, onDragEnd, reconnecting banner, add-list) + build + manual verify

Replaces §8's `BoardPage.tsx` placeholder. Keeps the **named** `export function BoardPage()` so `App.tsx` keeps resolving. Wires a single `DndContext`: lists in a horizontal `SortableContext`, cards in per-column vertical contexts, `onDragEnd` branches on the dragged item's `type`, computes the destination index, applies the pure updater optimistically, then fires the move mutation with a toast-on-error. The add-list composer sits at the row end.

**Files:** `client/src/pages/BoardPage.tsx` (replace placeholder)

- [ ] **Step 1: Replace** `client/src/pages/BoardPage.tsx` with the full page (full file):
  ```tsx
  import { useState } from 'react';
  import { useParams, useNavigate } from 'react-router';
  import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
  } from '@dnd-kit/core';
  import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
  import { useQueryClient } from '@tanstack/react-query';
  import type { BoardDetail, Id } from '@shared/types';
  import { useBoard, useMe, useMoveCard, useMoveList, useCreateList, qk } from '../api/queries';
  import { useBoardChannel } from '../api/socket';
  import { useToast } from '../components/ui/Toast';
  import { moveCard, moveList, sortByPosition } from '../lib/boardMoves';
  import { todayLocalISO } from '../lib/date';
  import { BoardHeader } from '../components/board/BoardHeader';
  import { ListColumn } from '../components/board/ListColumn';

  interface DndItemData {
    type: 'card' | 'list' | 'column';
    cardId?: Id;
    listId?: Id;
  }

  export function BoardPage() {
    const { boardId = '' } = useParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const board = useBoard(boardId);
    const me = useMe();
    const { connected, presence } = useBoardChannel(boardId);
    const toast = useToast();
    const moveCardMut = useMoveCard(boardId);
    const moveListMut = useMoveList(boardId);
    const createList = useCreateList(boardId);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const [addingList, setAddingList] = useState(false);
    const [listName, setListName] = useState('');

    const disabled = !connected;

    const onDragEnd = (e: DragEndEvent) => {
      if (disabled) return;
      const { active, over } = e;
      if (!over) return;
      const activeData = active.data.current as DndItemData | undefined;
      const overData = over.data.current as DndItemData | undefined;
      if (!activeData) return;
      const detail = qc.getQueryData<BoardDetail>(qk.board(boardId));
      if (!detail) return;

      if (activeData.type === 'list') {
        const listId = activeData.listId!;
        const overListId = overData?.listId;
        if (!overListId || overListId === listId) return;
        const dest = sortByPosition(detail.lists.filter((l) => l.id !== listId && l.archivedAt === null));
        const toIndex = dest.findIndex((l) => l.id === overListId);
        if (toIndex < 0) return;
        const next = moveList(detail, { listId, toIndex });
        qc.setQueryData(qk.board(boardId), next);
        const moved = next.lists.find((l) => l.id === listId)!;
        moveListMut.mutate(
          { listId, position: moved.position },
          { onError: () => toast('Could not move list') },
        );
        return;
      }

      const cardId = activeData.cardId!;
      let toListId: Id;
      let toIndex: number;
      if (overData?.type === 'card') {
        toListId = overData.listId!;
        const dest = sortByPosition(
          detail.cards.filter((c) => c.listId === toListId && c.id !== cardId && c.archivedAt === null),
        );
        const overIndex = dest.findIndex((c) => c.id === overData.cardId);
        toIndex = overIndex < 0 ? dest.length : overIndex;
      } else if (overData?.type === 'column' || overData?.type === 'list') {
        toListId = overData.listId!;
        toIndex = detail.cards.filter(
          (c) => c.listId === toListId && c.id !== cardId && c.archivedAt === null,
        ).length;
      } else {
        return;
      }
      const next = moveCard(detail, { cardId, toListId, toIndex });
      qc.setQueryData(qk.board(boardId), next);
      const moved = next.cards.find((c) => c.id === cardId)!;
      moveCardMut.mutate(
        { cardId, listId: moved.listId, position: moved.position },
        { onError: () => toast('Could not move card') },
      );
    };

    const submitList = () => {
      const trimmed = listName.trim();
      if (!trimmed) return;
      createList.mutate(trimmed, { onSuccess: () => setListName('') });
    };

    if (board.isLoading) return <div className="p-6 text-latte">Loading board…</div>;
    if (board.isError || !board.data)
      return <div className="p-6 text-red-700">Could not load this board.</div>;

    const detail = board.data;
    const labelById = new Map(detail.labels.map((l) => [l.id, l]));
    const memberById = new Map(detail.board.members.map((m) => [m.id, m]));
    const presentIds = new Set(presence.map((p) => p.id));
    const today = todayLocalISO();
    const lists = sortByPosition(detail.lists.filter((l) => l.archivedAt === null));
    const cardsForList = (listId: Id) =>
      sortByPosition(detail.cards.filter((c) => c.listId === listId && c.archivedAt === null));

    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {!connected && (
          <div className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
            Reconnecting… changes are paused
          </div>
        )}
        <BoardHeader
          boardId={boardId}
          board={detail.board}
          members={detail.board.members}
          presentIds={presentIds}
          isAdmin={me.data?.isAdmin ?? false}
          disabled={disabled}
        />
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex flex-1 items-start gap-3 overflow-x-auto p-4">
            <SortableContext
              items={lists.map((l) => `list:${l.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              {lists.map((l) => (
                <ListColumn
                  key={l.id}
                  boardId={boardId}
                  list={l}
                  cards={cardsForList(l.id)}
                  labelById={labelById}
                  memberById={memberById}
                  today={today}
                  disabled={disabled}
                  onOpenCard={(cardId) => navigate(`/b/${boardId}/c/${cardId}`)}
                />
              ))}
            </SortableContext>

            <div className="w-72 shrink-0">
              {addingList ? (
                <div className="flex flex-col gap-2 rounded-lg border border-sand bg-cream/60 p-2">
                  <input
                    autoFocus
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitList();
                      if (e.key === 'Escape') {
                        setAddingList(false);
                        setListName('');
                      }
                    }}
                    placeholder="List name…"
                    className="w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitList}
                      disabled={disabled || !listName.trim()}
                      className="rounded-md bg-coral px-3 py-1 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
                    >
                      Add list
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingList(false);
                        setListName('');
                      }}
                      className="rounded-md px-2 py-1 text-sm text-latte hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setAddingList(true)}
                  className="w-full rounded-lg border border-dashed border-sand bg-paper/60 px-3 py-2 text-left text-sm text-latte hover:border-coral hover:text-coral disabled:opacity-40"
                >
                  + Add a list
                </button>
              )}
            </div>
          </div>
        </DndContext>
      </div>
    );
  }
  ```

- [ ] **Step 2: Run the full client unit suite — expect pass.** `npm test -w client`
  - Expected: all client test files pass, including §10's `position` (4), `date` (3), `boardMoves` (6), alongside §8/§9 tests; overall `Test Files … passed`, exit 0.

- [ ] **Step 3: Typecheck + build the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` reports no type errors (no unused locals/params; `BoardPage` is a named export consumed by `App.tsx`), then Vite prints `✓ built in …` and writes `client/dist`. Exit 0.

- [ ] **Step 4: Manual verify against the real server.** Run `npm run dev` (server `:3000`, client `:5173`; seeded admin from `.env` `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Log in, create/open a board, then:
  - Board renders inside the AppShell with the `BoardHeader` (back arrow, accent strip, board name, ☆, your avatar, ⋯ menu).
  - Click the board name → it becomes an input; type a new name, press Enter → the header shows the new name (a `board:changed` refetch confirms it persisted).
  - Click **+ Add a list** → type "To Do", Enter → the column appears with count `0`. Add a second list "Doing".
  - In a column click **+ Add a card** → type "First card", Enter → the card appears and the column count becomes `1`; the composer stays open. Press Esc to close it.
  - Drag the card from "To Do" onto "Doing" → it moves immediately (optimistic cache update; the mutator's own debounced socket refetch reconciles); counts update on both columns.
  - Drag a card up/down within a column → order changes and holds after the debounced refetch.
  - Drag a column by its **title** to reorder the two columns horizontally → order holds.
  - Click a card (a plain click, no drag) → URL becomes `/b/:boardId/c/:cardId` (no modal yet — that overlay is §11; the board still shows).
  - Click the list **×** → the list disappears; open ⋯ → **Archived items…** → the archived list is listed with **Restore**; click Restore → it returns to the board.
  - ⋯ → **Make private** / **Make team** toggles the label on reopen. As an **admin**, ⋯ → **Members…** opens the dialog listing current members with **Remove** and an add list of other users with **Add**.
  - Open the same board in a **second browser** (or incognito, logged in as another seeded user) → each header shows the other user's avatar with a **coral ring** (presence); a card added in one tab appears in the other within ~1s.
  - Kill the server (Ctrl-C in the dev process, or toggle offline) → the amber **"Reconnecting… changes are paused"** banner appears and drag/add/rename controls are disabled; restart → the banner clears and the board refetches.
  - Stop with Ctrl-C.

- [ ] **Step 5: Commit.**
  ```
  git add client/src/pages/BoardPage.tsx
  git commit -m "feat(board): BoardPage with dnd-kit moves, live sync banner, add-list" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Section verification (all must hold before section 11)

- [ ] `npm test -w client -- lib/position` → `Tests 4 passed (4)`.
- [ ] `npm test -w client -- lib/date` → `Tests 3 passed (3)`.
- [ ] `npm test -w client -- lib/boardMoves` → `Tests 6 passed (6)`.
- [ ] `npm test -w client` → the whole client suite passes (§8 + §9 + §10's 13 new lib tests), exit 0.
- [ ] `npm run build -w client` → `tsc -b` clean (no `any`, no unused locals/params), `client/dist` produced; `BoardPage` is still a **named** export imported by `App.tsx`.
- [ ] Manual: board renders; inline board + list rename persist; add-list and add-card work; drag card within a column, between columns, and drag a column horizontally all persist after the debounced refetch; clicking a card navigates to `/b/:boardId/c/:cardId` (overlay is §11); list archive → Archived items… → Restore works; visibility toggles; admin Members… add/remove works; a second browser shows presence rings and live card updates within ~1s; killing the socket shows the amber "Reconnecting…" banner and disables drag/add/rename.
- [ ] Boundary respected: §10 does not import `CardDetail`; §11 owns wiring the card-detail overlay into `BoardPage` on the `/c/:cardId` route.


---

## Section 11: Client card detail, notifications bell, admin & settings pages

Builds the last client surfaces on top of Section 8's foundation and Section 10's `BoardPage`: the deep-linkable **CardDetail** modal (`/b/:boardId/c/:cardId`) with title inline-edit, plain-text description (save on blur), `LabelPicker`, `DueDatePicker`, `AssigneePicker`, `Checklist`, `Attachments`, `Comments` (with an `@mention` picker), a collapsed `ActivityLog`, and an archive button; the **NotificationsBell** that fills the AppShell slot (unread badge, dropdown, mark-all-read, 60s polling); the admin-only **AdminPage** (invite, members table, disk usage, an email-not-configured notice, and archived-boards recovery with restore + permanent purge); and the **SettingsPage** (name, avatar color, email-notifications toggle, change password).

### Boundary notes / assumed artifacts (all lower-numbered, execute before this section)

- **`api()` path convention (Section 8 `client.ts`, binding):** `api<T>(path, opts)` prepends `/api` and sets `credentials:'include'` + JSON `Content-Type` for a non-`FormData` body. So every path in this section is written **without** the `/api` prefix (e.g. `` `/cards/${id}` ``). For a `FormData` body `api()` leaves the `Content-Type` unset so the browser adds the multipart boundary.
- **`queries.ts` already exports (Section 8):** the `qk` key factory (`qk.me`, `qk.boards`, `qk.board(id)`, `qk.card(id)`, `qk.notifications`, `qk.search(q)`), `useMe`, `useBoard`, `useCard` (→ `CardDetailDto = CardDto & {comments,attachments,activity}`), `useNotifications`, and imports `useMutation, useQuery, useQueryClient` from `@tanstack/react-query` plus `api` from `./client`. This section **appends** new mutation hooks and reuses those keys; it never redeclares an existing hook. New hook params/returns use `string` for ids/colors and `void` returns (relying on query invalidation) to avoid touching Section 8's `@shared/types` import line; the two places that need extra types (`UserPublic` for the admin overview, `Me` for the profile hook — `Me` is already imported by Section 8) add a **separate** `import type { … } from '@shared/types';` statement anchored after the stable line `import { api } from './client';`. (`BoardSummary`, used by the new `useArchivedBoards` hook, is likewise already imported by Section 8's `queries.ts`, so it needs no new import.)
- **CardDetail route integration:** Section 8's router points both `/b/:boardId` and `/b/:boardId/c/:cardId` at `<BoardPage />`. This section modifies **`App.tsx`** (a Section 8 file) so the card route renders `<BoardPage />` **and** a `<CardDetailRoute />` overlay sibling; the board renders underneath (served from the React-Query cache, so no flicker) and the fixed-position modal floats on top. This keeps Section 10's `BoardPage.tsx` untouched.
- **AppShell slot:** Section 8's `AppShell.tsx` has a placeholder notifications `<button aria-label="Notifications">`. This section replaces that element with `<NotificationsBell />` (a surgical edit called out in Section 8's boundary notes).
- **Multipart field name:** the attachments route (Section 6) reads a single `req.file()` from a form field named **`file`** (Section 6's own test posts `name="file"`), so uploads append to `FormData` under the key `'file'`.
- **Admin API shapes (Section 7 + contract, binding):** the contract's admin routes are `POST /api/admin/invites`→`{link}`, `GET /api/admin/members`, `PATCH /api/admin/members/:id`, `POST /api/admin/members/:id/reset-password`→`{link}`, `GET /api/admin/archived-boards`, `POST /api/admin/restore {entity:'board', id}`, and `POST /api/admin/purge {entity, id}`. Section 7 pins the members shape as `{ members: UserPublic[]; diskUsageBytes: number; emailConfigured: boolean }` (`diskUsageBytes` = summed `attachments.size_bytes` across all cards; `members` includes deactivated users; `emailConfigured` = `!!(RESEND_API_KEY && EMAIL_FROM)`, which drives the "email not configured" notice), and `GET /api/admin/archived-boards` → `BoardSummary[]` (boards with `archived_at != null`). This section consumes all of these verbatim.

Consumed `@shared/types` (never redefined): `BoardSummary`, `BoardDetail`, `CardDto`, `CommentDto`, `AttachmentDto`, `ActivityDto`, `NotificationDto`, `Label`, `LabelColor`, `UserPublic`, `Me`, `Id`, and the `LABEL_HEX` const.

### Files

**Create**
- `client/src/lib/mentions.ts` — pure mention helpers (`splitMentions`, `getActiveMention`, `applyMention`)
- `client/src/components/card/CardDetail.tsx` — modal shell + title/description/archive
- `client/src/components/card/CardDetailRoute.tsx` — reads route params, mounts `CardDetail`
- `client/src/components/card/LabelPicker.tsx`
- `client/src/components/card/DueDatePicker.tsx`
- `client/src/components/card/AssigneePicker.tsx`
- `client/src/components/card/Checklist.tsx`
- `client/src/components/card/Attachments.tsx`
- `client/src/components/card/Comments.tsx`
- `client/src/components/card/ActivityLog.tsx`
- `client/src/components/NotificationsBell.tsx`

**Modify**
- `client/src/api/queries.ts` — append card/label/notification/profile/admin mutation + admin query hooks
- `client/src/App.tsx` — overlay `CardDetailRoute` on the card route
- `client/src/components/AppShell.tsx` — swap notifications placeholder for `NotificationsBell`
- `client/src/pages/AdminPage.tsx` — replace Section 8 stub with the admin page
- `client/src/pages/SettingsPage.tsx` — replace Section 8 stub with the settings page

**Test**
- `client/src/lib/mentions.test.ts` — mention helpers (TDD)
- `client/src/components/NotificationsBell.test.tsx` — unread badge + mark-all-read (TDD)

---

### Task 11.1: Card-detail + label + notification mutation hooks (`queries.ts`)

**Files:** `client/src/api/queries.ts` (modify)

These are thin fetch wrappers that invalidate `qk.card(cardId)` + `qk.board(boardId)` on success (the server also broadcasts `board:changed`, but invalidating locally makes the mutating client feel instant). No new type imports are needed — ids/colors are typed `string` and returns are `void`. Presentational/thin-wrapper code is verified by the client build and by E2E (Section 12), per the contract's testing conventions; the non-trivial logic (mentions, bell) is TDD'd in Tasks 11.2 and 11.9.

- [ ] **Step 1: Append the card/label/notification hooks to the end of `client/src/api/queries.ts`.** Paste verbatim:
  ```ts
  export function usePatchCard() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: {
        cardId: string;
        boardId: string;
        patch: {
          title?: string;
          description?: string;
          dueDate?: string | null;
          listId?: string;
          position?: string;
        };
      }) => api<void>(`/cards/${input.cardId}`, { method: 'PATCH', body: JSON.stringify(input.patch) }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useArchiveCard() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string }) =>
        api<void>(`/cards/${input.cardId}`, { method: 'DELETE' }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useAddAssignee() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; userId: string }) =>
        api<void>(`/cards/${input.cardId}/assignees`, {
          method: 'POST',
          body: JSON.stringify({ userId: input.userId }),
        }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useRemoveAssignee() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; userId: string }) =>
        api<void>(`/cards/${input.cardId}/assignees/${input.userId}`, { method: 'DELETE' }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useAddCardLabel() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; labelId: string }) =>
        api<void>(`/cards/${input.cardId}/labels`, {
          method: 'POST',
          body: JSON.stringify({ labelId: input.labelId }),
        }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useRemoveCardLabel() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; labelId: string }) =>
        api<void>(`/cards/${input.cardId}/labels/${input.labelId}`, { method: 'DELETE' }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useCreateLabel() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { boardId: string; name: string; color: string }) =>
        api<void>(`/boards/${input.boardId}/labels`, {
          method: 'POST',
          body: JSON.stringify({ name: input.name, color: input.color }),
        }),
      onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: qk.board(input.boardId) }),
    });
  }

  export function usePatchLabel() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: {
        labelId: string;
        boardId: string;
        patch: { name?: string; color?: string };
      }) => api<void>(`/labels/${input.labelId}`, { method: 'PATCH', body: JSON.stringify(input.patch) }),
      onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: qk.board(input.boardId) }),
    });
  }

  export function useDeleteLabel() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { labelId: string; boardId: string }) =>
        api<void>(`/labels/${input.labelId}`, { method: 'DELETE' }),
      onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: qk.board(input.boardId) }),
    });
  }

  export function useAddChecklistItem() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; text: string }) =>
        api<void>(`/cards/${input.cardId}/checklist`, {
          method: 'POST',
          body: JSON.stringify({ text: input.text }),
        }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function usePatchChecklistItem() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: {
        itemId: string;
        cardId: string;
        boardId: string;
        patch: { text?: string; done?: boolean; position?: string };
      }) => api<void>(`/checklist/${input.itemId}`, { method: 'PATCH', body: JSON.stringify(input.patch) }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useDeleteChecklistItem() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { itemId: string; cardId: string; boardId: string }) =>
        api<void>(`/checklist/${input.itemId}`, { method: 'DELETE' }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useAddComment() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; body: string }) =>
        api<void>(`/cards/${input.cardId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: input.body }),
        }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useUploadAttachment() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { cardId: string; boardId: string; file: File }) => {
        const form = new FormData();
        form.append('file', input.file);
        return api<void>(`/cards/${input.cardId}/attachments`, { method: 'POST', body: form });
      },
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useDeleteAttachment() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { attachmentId: string; cardId: string; boardId: string }) =>
        api<void>(`/attachments/${input.attachmentId}`, { method: 'DELETE' }),
      onSuccess: (_d, input) => {
        qc.invalidateQueries({ queryKey: qk.card(input.cardId) });
        qc.invalidateQueries({ queryKey: qk.board(input.boardId) });
      },
    });
  }

  export function useMarkNotificationsRead() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (ids?: string[]) =>
        api<void>('/notifications/read', {
          method: 'POST',
          body: JSON.stringify(ids && ids.length ? { ids } : {}),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
    });
  }
  ```

- [ ] **Step 2: Enable 60s polling on the existing `useNotifications` hook.** In `client/src/api/queries.ts`, locate Section 8's `useNotifications` and add `refetchInterval: 60000` to its `useQuery` options. Replace:
  ```ts
  export function useNotifications() {
    return useQuery({
      queryKey: qk.notifications,
      queryFn: () => api<NotificationDto[]>('/notifications'),
    });
  }
  ```
  with:
  ```ts
  export function useNotifications() {
    return useQuery({
      queryKey: qk.notifications,
      queryFn: () => api<NotificationDto[]>('/notifications'),
      refetchInterval: 60000,
    });
  }
  ```

- [ ] **Step 3: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` reports no type errors; Vite prints `✓ built in …` and writes `client/dist`. (New hooks are exported-but-unused for now — `noUnusedLocals` does not flag exports.)

- [ ] **Step 4: Commit.**
  ```
  git add client/src/api/queries.ts
  git commit -m "feat(card): card/label/notification mutation hooks + 60s notifications poll" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.2: Mention helpers `lib/mentions.ts` (TDD)

**Files:** `client/src/lib/mentions.ts`, `client/src/lib/mentions.test.ts`

Comment bodies store mentions as `@[userId]` markup (spec). The composer needs to (a) detect an in-progress `@query` at the caret to drive the picker, (b) replace it with a `@[userId]` token, and the renderer needs to (c) split a body into text/mention segments. All three are pure and TDD'd here; the components in Tasks 11.7 consume them.

- [ ] **Step 1: Write the failing test `client/src/lib/mentions.test.ts`.** Full file:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { splitMentions, getActiveMention, applyMention } from './mentions';

  describe('splitMentions', () => {
    it('splits a body into text and mention segments in order', () => {
      expect(splitMentions('hi @[u1] and @[u2]!')).toEqual([
        { type: 'text', value: 'hi ' },
        { type: 'mention', userId: 'u1' },
        { type: 'text', value: ' and ' },
        { type: 'mention', userId: 'u2' },
        { type: 'text', value: '!' },
      ]);
    });

    it('returns a single text segment when there are no mentions', () => {
      expect(splitMentions('plain text')).toEqual([{ type: 'text', value: 'plain text' }]);
    });

    it('accepts ids with dashes and underscores', () => {
      expect(splitMentions('@[a-b_c9]')).toEqual([{ type: 'mention', userId: 'a-b_c9' }]);
    });
  });

  describe('getActiveMention', () => {
    it('detects an @query at the caret after whitespace', () => {
      expect(getActiveMention('hello @ali', 10)).toEqual({ start: 6, query: 'ali' });
    });

    it('detects an @query at the start of the text', () => {
      expect(getActiveMention('@bob', 4)).toEqual({ start: 0, query: 'bob' });
    });

    it('returns null when there is no active mention', () => {
      expect(getActiveMention('hello world', 11)).toBeNull();
    });

    it('ignores an @ that is not preceded by whitespace (e.g. an email)', () => {
      expect(getActiveMention('mail x@y', 8)).toBeNull();
    });
  });

  describe('applyMention', () => {
    it('replaces the active @query with an @[userId] token plus a trailing space', () => {
      expect(applyMention('hi @al', 6, 'u9')).toEqual({ text: 'hi @[u9] ', caret: 9 });
    });

    it('is a no-op when there is no active mention', () => {
      expect(applyMention('hi there', 8, 'u9')).toEqual({ text: 'hi there', caret: 8 });
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.** `npm test -w client -- mentions`
  - Expected: FAIL — `Failed to load url ./mentions` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement `client/src/lib/mentions.ts`.** Full file:
  ```ts
  export type MentionSegment =
    | { type: 'text'; value: string }
    | { type: 'mention'; userId: string };

  const TOKEN = /@\[([A-Za-z0-9_-]+)\]/g;
  const ACTIVE = /(?:^|\s)@([^\s@[\]]*)$/;

  export function splitMentions(body: string): MentionSegment[] {
    const segments: MentionSegment[] = [];
    let last = 0;
    for (const m of body.matchAll(TOKEN)) {
      const index = m.index ?? 0;
      if (index > last) segments.push({ type: 'text', value: body.slice(last, index) });
      segments.push({ type: 'mention', userId: m[1] });
      last = index + m[0].length;
    }
    if (last < body.length) segments.push({ type: 'text', value: body.slice(last) });
    return segments;
  }

  export function getActiveMention(text: string, caret: number): { start: number; query: string } | null {
    const match = ACTIVE.exec(text.slice(0, caret));
    if (!match) return null;
    const query = match[1];
    return { start: caret - query.length - 1, query };
  }

  export function applyMention(
    text: string,
    caret: number,
    userId: string,
  ): { text: string; caret: number } {
    const active = getActiveMention(text, caret);
    if (!active) return { text, caret };
    const head = `${text.slice(0, active.start)}@[${userId}] `;
    return { text: head + text.slice(caret), caret: head.length };
  }
  ```

- [ ] **Step 4: Run the test — expect pass.** `npm test -w client -- mentions`
  - Expected: `Test Files 1 passed (1)` · `Tests 9 passed (9)`.

- [ ] **Step 5: Commit.**
  ```
  git add client/src/lib/mentions.ts client/src/lib/mentions.test.ts
  git commit -m "feat(card): pure mention helpers (split/detect/apply)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.3: LabelPicker component

**Files:** `client/src/components/card/LabelPicker.tsx`

A checkbox list of the board's labels (each with a color strip) that toggles the card's labels, plus an inline create/rename/delete editor with an 8-swatch color picker. Presentational + thin wrappers over Task 11.1 hooks; verified by the build (Step 2) and by E2E.

- [ ] **Step 1: Create `client/src/components/card/LabelPicker.tsx`.** Full file:
  ```tsx
  import { useState } from 'react';
  import { LABEL_HEX, type Label, type LabelColor } from '@shared/types';
  import {
    useAddCardLabel,
    useRemoveCardLabel,
    useCreateLabel,
    usePatchLabel,
    useDeleteLabel,
  } from '../../api/queries';

  const COLORS: LabelColor[] = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

  function SwatchRow({ value, onChange }: { value: LabelColor; onChange: (c: LabelColor) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            style={{ backgroundColor: LABEL_HEX[c] }}
            className={`h-6 w-6 rounded ${
              value === c ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : ''
            }`}
          />
        ))}
      </div>
    );
  }

  export function LabelPicker({
    boardId,
    cardId,
    labels,
    activeLabelIds,
  }: {
    boardId: string;
    cardId: string;
    labels: Label[];
    activeLabelIds: string[];
  }) {
    const addLabel = useAddCardLabel();
    const removeLabel = useRemoveCardLabel();
    const createLabel = useCreateLabel();
    const patchLabel = usePatchLabel();
    const deleteLabel = useDeleteLabel();
    const [editingId, setEditingId] = useState<string | 'new' | null>(null);
    const [draftName, setDraftName] = useState('');
    const [draftColor, setDraftColor] = useState<LabelColor>('coral');

    const active = new Set(activeLabelIds);

    function startCreate() {
      setEditingId('new');
      setDraftName('');
      setDraftColor('coral');
    }
    function startEdit(label: Label) {
      setEditingId(label.id);
      setDraftName(label.name);
      setDraftColor(label.color);
    }
    function cancel() {
      setEditingId(null);
    }
    function save() {
      if (editingId === 'new') {
        createLabel.mutate({ boardId, name: draftName.trim(), color: draftColor }, { onSuccess: cancel });
      } else if (editingId) {
        patchLabel.mutate(
          { labelId: editingId, boardId, patch: { name: draftName.trim(), color: draftColor } },
          { onSuccess: cancel },
        );
      }
    }
    function toggle(label: Label) {
      if (active.has(label.id)) removeLabel.mutate({ cardId, boardId, labelId: label.id });
      else addLabel.mutate({ cardId, boardId, labelId: label.id });
    }

    return (
      <div className="w-64">
        <ul className="flex flex-col gap-1">
          {labels.map((label) =>
            editingId === label.id ? (
              <li key={label.id} className="rounded-md border border-sand bg-cream p-2">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Label name"
                  className="mb-2 w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
                />
                <SwatchRow value={draftColor} onChange={setDraftColor} />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button type="button" onClick={save} className="text-sm font-medium text-coral">
                      Save
                    </button>
                    <button type="button" onClick={cancel} className="text-sm text-latte">
                      Cancel
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLabel.mutate({ labelId: label.id, boardId }, { onSuccess: cancel })}
                    className="text-sm text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ) : (
              <li key={label.id} className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 hover:bg-sand/30">
                  <input type="checkbox" checked={active.has(label.id)} onChange={() => toggle(label)} />
                  <span className="h-4 w-8 rounded" style={{ backgroundColor: LABEL_HEX[label.color] }} />
                  <span className="flex-1 truncate text-sm text-ink">
                    {label.name || <span className="text-latte">({label.color})</span>}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label={`Edit ${label.name || label.color} label`}
                  onClick={() => startEdit(label)}
                  className="text-xs text-latte hover:text-rust"
                >
                  Edit
                </button>
              </li>
            ),
          )}
        </ul>

        {editingId === 'new' ? (
          <div className="mt-2 rounded-md border border-sand bg-cream p-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Label name"
              autoFocus
              className="mb-2 w-full rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
            />
            <SwatchRow value={draftColor} onChange={setDraftColor} />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={save} className="text-sm font-medium text-coral">
                Create
              </button>
              <button type="button" onClick={cancel} className="text-sm text-latte">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startCreate}
            className="mt-2 w-full rounded-md border border-dashed border-sand py-1.5 text-sm text-latte hover:border-coral hover:text-coral"
          >
            + New label
          </button>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/card/LabelPicker.tsx
  git commit -m "feat(card): LabelPicker with toggle + inline create/rename/delete" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.4: DueDatePicker + AssigneePicker components

**Files:** `client/src/components/card/DueDatePicker.tsx`, `client/src/components/card/AssigneePicker.tsx`

- [ ] **Step 1: Create `client/src/components/card/DueDatePicker.tsx`.** Full file (date-only input + clear; `dueDate` is `'YYYY-MM-DD'` per contract, which is exactly the native `<input type="date">` value format):
  ```tsx
  import { usePatchCard } from '../../api/queries';

  export function DueDatePicker({
    boardId,
    cardId,
    dueDate,
  }: {
    boardId: string;
    cardId: string;
    dueDate: string | null;
  }) {
    const patchCard = usePatchCard();
    return (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dueDate ?? ''}
          onChange={(e) =>
            patchCard.mutate({ cardId, boardId, patch: { dueDate: e.target.value || null } })
          }
          className="rounded-md border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
        />
        {dueDate && (
          <button
            type="button"
            onClick={() => patchCard.mutate({ cardId, boardId, patch: { dueDate: null } })}
            className="text-sm text-latte hover:text-red-700"
          >
            Clear
          </button>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `client/src/components/card/AssigneePicker.tsx`.** Full file (checkbox list of board members with avatars):
  ```tsx
  import type { UserPublic } from '@shared/types';
  import { Avatar } from '../ui/Avatar';
  import { useAddAssignee, useRemoveAssignee } from '../../api/queries';

  export function AssigneePicker({
    boardId,
    cardId,
    members,
    assigneeIds,
  }: {
    boardId: string;
    cardId: string;
    members: UserPublic[];
    assigneeIds: string[];
  }) {
    const addAssignee = useAddAssignee();
    const removeAssignee = useRemoveAssignee();
    const active = new Set(assigneeIds);

    function toggle(userId: string) {
      if (active.has(userId)) removeAssignee.mutate({ cardId, boardId, userId });
      else addAssignee.mutate({ cardId, boardId, userId });
    }

    return (
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id}>
            <label className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-sand/30">
              <input type="checkbox" checked={active.has(m.id)} onChange={() => toggle(m.id)} />
              <Avatar name={m.name} color={m.avatarColor} size={24} />
              <span className="text-sm text-ink">{m.name}</span>
            </label>
          </li>
        ))}
      </ul>
    );
  }
  ```

- [ ] **Step 3: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 4: Commit.**
  ```
  git add client/src/components/card/DueDatePicker.tsx client/src/components/card/AssigneePicker.tsx
  git commit -m "feat(card): DueDatePicker (date + clear) and AssigneePicker" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.5: Checklist component

**Files:** `client/src/components/card/Checklist.tsx`

One simple checklist per card: add, toggle done, inline edit text, delete, and an `x/y` progress line. New items are appended server-side (position = end), so the client never sends a position.

- [ ] **Step 1: Create `client/src/components/card/Checklist.tsx`.** Full file:
  ```tsx
  import { useState } from 'react';
  import type { ChecklistItemDto } from '@shared/types';
  import {
    useAddChecklistItem,
    usePatchChecklistItem,
    useDeleteChecklistItem,
  } from '../../api/queries';

  export function Checklist({
    boardId,
    cardId,
    items,
  }: {
    boardId: string;
    cardId: string;
    items: ChecklistItemDto[];
  }) {
    const addItem = useAddChecklistItem();
    const patchItem = usePatchChecklistItem();
    const deleteItem = useDeleteChecklistItem();
    const [newText, setNewText] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const done = items.filter((i) => i.done).length;

    function add() {
      const text = newText.trim();
      if (!text) return;
      addItem.mutate({ cardId, boardId, text }, { onSuccess: () => setNewText('') });
    }
    function startEdit(item: ChecklistItemDto) {
      setEditingId(item.id);
      setEditText(item.text);
    }
    function saveEdit() {
      if (!editingId) return;
      const text = editText.trim();
      if (text) patchItem.mutate({ itemId: editingId, cardId, boardId, patch: { text } });
      setEditingId(null);
    }

    return (
      <div>
        <p className="mb-2 text-sm text-latte">
          {done}/{items.length} done
        </p>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() =>
                  patchItem.mutate({ itemId: item.id, cardId, boardId, patch: { done: !item.done } })
                }
              />
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  className="flex-1 rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className={`flex-1 text-left text-sm ${
                    item.done ? 'text-latte line-through' : 'text-ink'
                  }`}
                >
                  {item.text}
                </button>
              )}
              <button
                type="button"
                aria-label="Delete item"
                onClick={() => deleteItem.mutate({ itemId: item.id, cardId, boardId })}
                className="text-xs text-latte hover:text-red-700"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add an item"
            className="flex-1 rounded border border-sand bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-md bg-coral px-3 py-1 text-sm font-medium text-paper hover:bg-rust"
          >
            Add
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/card/Checklist.tsx
  git commit -m "feat(card): Checklist with add/toggle/edit/delete + progress" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.6: Attachments component

**Files:** `client/src/components/card/Attachments.tsx`

File input with a 20 MB client-side pre-check (server enforces the same cap), an upload button, a list with download links, and delete. Download links point at the real `/api/attachments/:id` path (a plain same-origin anchor — cookies are sent automatically and the server responds `Content-Disposition: attachment`, so the browser downloads without leaving the SPA).

- [ ] **Step 1: Create `client/src/components/card/Attachments.tsx`.** Full file:
  ```tsx
  import { useRef, type ChangeEvent } from 'react';
  import type { AttachmentDto } from '@shared/types';
  import { useToast } from '../ui/Toast';
  import { useUploadAttachment, useDeleteAttachment } from '../../api/queries';

  const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  export function Attachments({
    boardId,
    cardId,
    attachments,
  }: {
    boardId: string;
    cardId: string;
    attachments: AttachmentDto[];
  }) {
    const toast = useToast();
    const upload = useUploadAttachment();
    const remove = useDeleteAttachment();
    const inputRef = useRef<HTMLInputElement>(null);

    function onPick(e: ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        toast('File is too large (max 20 MB).');
        return;
      }
      upload.mutate({ cardId, boardId, file }, { onError: () => toast('Upload failed. Try again.') });
    }

    return (
      <div>
        <ul className="flex flex-col gap-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-sand bg-paper px-2 py-1"
            >
              <a
                href={`/api/attachments/${a.id}`}
                className="flex-1 truncate text-sm text-rust hover:underline"
              >
                {a.filename}
              </a>
              <span className="text-xs text-latte">{formatSize(a.sizeBytes)}</span>
              <button
                type="button"
                aria-label={`Delete ${a.filename}`}
                onClick={() => remove.mutate({ attachmentId: a.id, cardId, boardId })}
                className="text-xs text-latte hover:text-red-700"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <input ref={inputRef} type="file" onChange={onPick} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="mt-2 rounded-md border border-sand px-3 py-1 text-sm text-rust hover:border-coral disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading…' : '+ Add attachment'}
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 3: Commit.**
  ```
  git add client/src/components/card/Attachments.tsx
  git commit -m "feat(card): Attachments with 20MB check, download links, delete" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.7: Comments (with @mention picker) + ActivityLog

**Files:** `client/src/components/card/Comments.tsx`, `client/src/components/card/ActivityLog.tsx`

Comments render each body through `splitMentions` (mention tokens → highlighted `@Name`), and the composer drives an `@`-triggered member picker via the pure `getActiveMention`/`applyMention` helpers from Task 11.2. ActivityLog is collapsed by default (spec) and prettifies each raw activity `type`.

- [ ] **Step 1: Create `client/src/components/card/Comments.tsx`.** Full file:
  ```tsx
  import { useRef, useState, type ChangeEvent } from 'react';
  import type { CommentDto, UserPublic } from '@shared/types';
  import { Avatar } from '../ui/Avatar';
  import { useAddComment } from '../../api/queries';
  import { splitMentions, getActiveMention, applyMention } from '../../lib/mentions';

  function MentionText({ body, nameById }: { body: string; nameById: Map<string, string> }) {
    return (
      <>
        {splitMentions(body).map((seg, i) =>
          seg.type === 'text' ? (
            <span key={i}>{seg.value}</span>
          ) : (
            <span key={i} className="rounded bg-sun/30 px-1 font-medium text-rust">
              @{nameById.get(seg.userId) ?? 'unknown'}
            </span>
          ),
        )}
      </>
    );
  }

  export function Comments({
    boardId,
    cardId,
    comments,
    members,
  }: {
    boardId: string;
    cardId: string;
    comments: CommentDto[];
    members: UserPublic[];
  }) {
    const addComment = useAddComment();
    const [body, setBody] = useState('');
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const nameById = new Map(members.map((m) => [m.id, m.name]));

    function refreshMention(el: HTMLTextAreaElement) {
      const active = getActiveMention(el.value, el.selectionStart ?? el.value.length);
      setMentionQuery(active ? active.query : null);
    }
    function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
      setBody(e.target.value);
      refreshMention(e.target);
    }
    function pickMention(userId: string) {
      const el = textareaRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? body.length;
      const next = applyMention(body, caret, userId);
      setBody(next.text);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      });
    }
    function submit() {
      const trimmed = body.trim();
      if (!trimmed) return;
      addComment.mutate(
        { cardId, boardId, body: trimmed },
        {
          onSuccess: () => {
            setBody('');
            setMentionQuery(null);
          },
        },
      );
    }

    const matches =
      mentionQuery === null
        ? []
        : members
            .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
            .slice(0, 6);

    return (
      <div>
        <ul className="mb-4 flex flex-col gap-3">
          {comments.map((c) => {
            const author = members.find((m) => m.id === c.authorId);
            return (
              <li key={c.id} className="flex gap-2">
                <Avatar name={author?.name ?? '?'} color={author?.avatarColor ?? 'gray'} size={28} />
                <div className="flex-1">
                  <div className="text-sm">
                    <span className="font-medium text-ink">{author?.name ?? 'Unknown'}</span>{' '}
                    <span className="text-xs text-latte">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink">
                    <MentionText body={c.body} nameById={nameById} />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={onChange}
            onKeyUp={(e) => refreshMention(e.currentTarget)}
            onClick={(e) => refreshMention(e.currentTarget)}
            placeholder="Write a comment… use @ to mention"
            rows={3}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-coral"
          />
          {matches.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-sand bg-paper py-1 shadow-sm">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => pickMention(m.id)}
                    className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-sand/40"
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={20} />
                    <span className="text-ink">{m.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || addComment.isPending}
          className="mt-2 rounded-md bg-coral px-4 py-1.5 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
        >
          {addComment.isPending ? 'Posting…' : 'Comment'}
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `client/src/components/card/ActivityLog.tsx`.** Full file:
  ```tsx
  import { useState } from 'react';
  import type { ActivityDto, UserPublic } from '@shared/types';

  export function ActivityLog({
    activity,
    members,
  }: {
    activity: ActivityDto[];
    members: UserPublic[];
  }) {
    const [open, setOpen] = useState(false);
    const nameById = new Map(members.map((m) => [m.id, m.name]));

    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-medium text-rust hover:underline"
        >
          {open ? 'Hide' : 'Show'} activity ({activity.length})
        </button>
        {open && (
          <ul className="mt-2 flex flex-col gap-1">
            {activity.map((a) => (
              <li key={a.id} className="text-sm text-latte">
                <span className="text-ink">{nameById.get(a.actorId) ?? 'Someone'}</span>{' '}
                {a.type.replace(/[._]/g, ' ')}{' '}
                <span className="text-xs">· {new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Typecheck the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 4: Commit.**
  ```
  git add client/src/components/card/Comments.tsx client/src/components/card/ActivityLog.tsx
  git commit -m "feat(card): Comments with @mention picker + collapsed ActivityLog" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.8: CardDetail modal assembly + deep-link route integration

**Files:** `client/src/components/card/CardDetail.tsx`, `client/src/components/card/CardDetailRoute.tsx`, `client/src/App.tsx` (modify)

Assembles all the pickers into the modal (title inline-edit, description save-on-blur, archive), then wires the deep-link route so `/b/:boardId/c/:cardId` renders `BoardPage` with the modal overlaid. Local title/description state is seeded once from the first successful `useCard` load and the modal remounts per card via `key={cardId}`, so switching cards resets cleanly (last-write-wins on scalars matches the spec's concurrency policy).

- [ ] **Step 1: Create `client/src/components/card/CardDetail.tsx`.** Full file:
  ```tsx
  import { useEffect, useState, type ReactNode } from 'react';
  import type { UserPublic } from '@shared/types';
  import { useCard, useBoard, usePatchCard, useArchiveCard } from '../../api/queries';
  import { LabelPicker } from './LabelPicker';
  import { DueDatePicker } from './DueDatePicker';
  import { AssigneePicker } from './AssigneePicker';
  import { Checklist } from './Checklist';
  import { Attachments } from './Attachments';
  import { Comments } from './Comments';
  import { ActivityLog } from './ActivityLog';

  function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-latte">{label}</h3>
        {children}
      </section>
    );
  }

  export function CardDetail({
    boardId,
    cardId,
    onClose,
  }: {
    boardId: string;
    cardId: string;
    onClose: () => void;
  }) {
    const cardQuery = useCard(cardId);
    const boardQuery = useBoard(boardId);
    const patchCard = usePatchCard();
    const archiveCard = useArchiveCard();
    const card = cardQuery.data;
    const board = boardQuery.data;

    const [title, setTitle] = useState<string | null>(null);
    const [description, setDescription] = useState<string | null>(null);

    useEffect(() => {
      if (card) {
        setTitle((t) => (t === null ? card.title : t));
        setDescription((d) => (d === null ? card.description : d));
      }
    }, [card]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    function saveTitle() {
      const next = (title ?? '').trim();
      if (card && next && next !== card.title) {
        patchCard.mutate({ cardId, boardId, patch: { title: next } });
      }
    }
    function saveDescription() {
      if (card && description !== null && description !== card.description) {
        patchCard.mutate({ cardId, boardId, patch: { description } });
      }
    }
    function archive() {
      archiveCard.mutate({ cardId, boardId }, { onSuccess: onClose });
    }

    const members: UserPublic[] = board?.board.members ?? [];

    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-16"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={card ? card.title : 'Card'}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-[10px] border border-sand bg-paper p-6 shadow-sm"
        >
          {cardQuery.isLoading && <p className="text-latte">Loading card…</p>}
          {cardQuery.isError && <p className="text-red-700">Could not load this card.</p>}

          {card && (
            <>
              <div className="flex items-start justify-between gap-4">
                <input
                  value={title ?? ''}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  aria-label="Card title"
                  className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-xl font-semibold text-ink outline-none hover:border-sand focus:border-coral"
                />
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="shrink-0 text-latte hover:text-rust"
                >
                  ✕
                </button>
              </div>

              <Field label="Description">
                <textarea
                  value={description ?? ''}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  placeholder="Add a more detailed description…"
                  rows={4}
                  className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-coral"
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Labels">
                  <LabelPicker
                    boardId={boardId}
                    cardId={cardId}
                    labels={board?.labels ?? []}
                    activeLabelIds={card.labelIds}
                  />
                </Field>
                <Field label="Due date">
                  <DueDatePicker boardId={boardId} cardId={cardId} dueDate={card.dueDate} />
                </Field>
                <Field label="Assignees">
                  <AssigneePicker
                    boardId={boardId}
                    cardId={cardId}
                    members={members}
                    assigneeIds={card.assigneeIds}
                  />
                </Field>
                <Field label="Checklist">
                  <Checklist boardId={boardId} cardId={cardId} items={card.checklist} />
                </Field>
              </div>

              <Field label="Attachments">
                <Attachments boardId={boardId} cardId={cardId} attachments={card.attachments} />
              </Field>

              <Field label="Comments">
                <Comments boardId={boardId} cardId={cardId} comments={card.comments} members={members} />
              </Field>

              <Field label="Activity">
                <ActivityLog activity={card.activity} members={members} />
              </Field>

              <div className="mt-6 border-t border-sand pt-4">
                <button
                  type="button"
                  onClick={archive}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Archive card
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `client/src/components/card/CardDetailRoute.tsx`.** Full file:
  ```tsx
  import { useNavigate, useParams } from 'react-router';
  import { CardDetail } from './CardDetail';

  export function CardDetailRoute() {
    const { boardId = '', cardId = '' } = useParams();
    const navigate = useNavigate();
    if (!cardId) return null;
    return (
      <CardDetail
        key={cardId}
        boardId={boardId}
        cardId={cardId}
        onClose={() => navigate(`/b/${boardId}`)}
      />
    );
  }
  ```

- [ ] **Step 3: Add the `CardDetailRoute` import to `client/src/App.tsx`.** After the existing line:
  ```tsx
  import { BoardPage } from './pages/BoardPage';
  ```
  add:
  ```tsx
  import { CardDetailRoute } from './components/card/CardDetailRoute';
  ```

- [ ] **Step 4: Overlay the modal on the card route in `client/src/App.tsx`.** Replace the line:
  ```tsx
  <Route path="/b/:boardId/c/:cardId" element={<BoardPage />} />
  ```
  with:
  ```tsx
  <Route
    path="/b/:boardId/c/:cardId"
    element={
      <>
        <BoardPage />
        <CardDetailRoute />
      </>
    }
  />
  ```

- [ ] **Step 5: Typecheck + build the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …` and writes `client/dist`.

- [ ] **Step 6: Manual verify against the real server.** `npm run dev`; log in (seeded admin). Create a board, add a list + a card (Section 10 UI). Then:
  - Click the card → URL becomes `/b/:boardId/c/:cardId`; the modal opens over the board.
  - Edit the title, click outside → the title persists (reopen the card to confirm).
  - Type a description, click outside → it persists.
  - Open **Labels**: check a label (the card gains it); click **+ New label**, name it, pick a color, Create → it appears and can be checked; Edit renames/recolors; Delete removes it.
  - Set a **Due date**, then **Clear** it.
  - Toggle an **Assignee** on/off.
  - Add a **Checklist** item, toggle it done (progress updates to `1/1`), edit its text, delete it.
  - **Attachments**: add a small file → it lists with size and downloads on click; try a >20 MB file → a toast "File is too large" appears and nothing uploads; delete an attachment.
  - **Comments**: type `@`, pick a teammate from the dropdown (inserts a token), finish the comment, post → the comment shows with the mention rendered as `@Name`.
  - Expand **Activity** → rows are listed (collapsed by default).
  - Press **Esc** (or click the backdrop, or ✕) → the modal closes back to `/b/:boardId`.
  - Deep-link: paste `/b/:boardId/c/:cardId` into a fresh tab → the board renders with the modal already open.
  - Click **Archive card** → the modal closes and the card is gone from the board.
  - Stop with Ctrl-C.

- [ ] **Step 7: Commit.**
  ```
  git add client/src/components/card/CardDetail.tsx client/src/components/card/CardDetailRoute.tsx client/src/App.tsx
  git commit -m "feat(card): CardDetail modal assembly + deep-linkable route overlay" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.9: NotificationsBell (TDD) + AppShell integration

**Files:** `client/src/components/NotificationsBell.tsx`, `client/src/components/NotificationsBell.test.tsx`, `client/src/components/AppShell.tsx` (modify)

The bell owns real logic (unread-count derivation, mark-all-read), so it is TDD'd. It reuses the now-polling `useNotifications` (60s, from Task 11.1) and `useMarkNotificationsRead`.

- [ ] **Step 1: Write the failing test `client/src/components/NotificationsBell.test.tsx`.** Full file:
  ```tsx
  import { render, screen, waitFor, fireEvent } from '@testing-library/react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { MemoryRouter } from 'react-router';
  import { vi, describe, it, expect, beforeEach } from 'vitest';
  import { NotificationsBell } from './NotificationsBell';
  import type { NotificationDto } from '@shared/types';

  const apiMock = vi.fn();
  vi.mock('../api/client', () => ({
    api: (path: string, opts?: RequestInit) => apiMock(path, opts),
    ApiError: class extends Error {},
  }));

  function notif(over: Partial<NotificationDto>): NotificationDto {
    return {
      id: 'n',
      type: 'assigned',
      cardId: 'c1',
      cardTitle: 'Card One',
      boardId: 'b1',
      actorId: 'u2',
      actorName: 'Alice',
      readAt: null,
      createdAt: '2026-07-14T10:00:00.000Z',
      ...over,
    };
  }

  function renderBell(notifications: NotificationDto[]) {
    apiMock.mockImplementation((path: string) =>
      path === '/notifications' ? Promise.resolve(notifications) : Promise.resolve(undefined),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <NotificationsBell />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  describe('NotificationsBell', () => {
    beforeEach(() => apiMock.mockReset());

    it('shows the unread-count badge and lists notifications on open', async () => {
      renderBell([
        notif({ id: 'n1', readAt: null }),
        notif({ id: 'n2', readAt: '2026-07-14T09:00:00.000Z' }),
      ]);
      expect(await screen.findByText('1')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      expect(await screen.findAllByText('Card One')).toHaveLength(2);
    });

    it('marks all read via POST /notifications/read', async () => {
      renderBell([notif({ id: 'n1', readAt: null })]);
      await screen.findByText('1');
      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      fireEvent.click(await screen.findByRole('button', { name: /mark all read/i }));
      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          '/notifications/read',
          expect.objectContaining({ method: 'POST', body: '{}' }),
        ),
      );
    });
  });
  ```

- [ ] **Step 2: Run the test — expect failure.** `npm test -w client -- NotificationsBell`
  - Expected: FAIL — `Failed to load url ./NotificationsBell` (module not found). `Test Files 1 failed (1)`.

- [ ] **Step 3: Implement `client/src/components/NotificationsBell.tsx`.** Full file:
  ```tsx
  import { useEffect, useRef, useState } from 'react';
  import { Link } from 'react-router';
  import type { NotificationDto } from '@shared/types';
  import { useNotifications, useMarkNotificationsRead } from '../api/queries';

  function describeNotification(n: NotificationDto): string {
    switch (n.type) {
      case 'assigned':
        return 'assigned you to';
      case 'mentioned':
        return 'mentioned you on';
      case 'comment_on_your_card':
        return 'commented on';
      case 'due_soon':
        return 'is due soon:';
      default:
        return 'updated';
    }
  }

  export function NotificationsBell() {
    const { data } = useNotifications();
    const markRead = useMarkNotificationsRead();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const notifications = data ?? [];
    const unread = notifications.filter((n) => n.readAt === null).length;

    useEffect(() => {
      if (!open) return;
      const onDown = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      };
      window.addEventListener('mousedown', onDown);
      return () => window.removeEventListener('mousedown', onDown);
    }, [open]);

    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setOpen((v) => !v)}
          className="relative text-latte hover:text-rust"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-paper">
              {unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-sand bg-paper shadow-sm">
            <div className="flex items-center justify-between border-b border-sand px-3 py-2">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              <button
                type="button"
                onClick={() => markRead.mutate(undefined)}
                disabled={unread === 0}
                className="text-xs text-rust hover:underline disabled:text-latte disabled:no-underline"
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-96 overflow-y-auto py-1">
              {notifications.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-latte">You're all caught up.</li>
              )}
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/b/${n.boardId}/c/${n.cardId}`}
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2 text-sm hover:bg-sand/40 ${
                      n.readAt === null ? 'bg-sun/10' : ''
                    }`}
                  >
                    <span className="text-ink">
                      {n.actorName ? `${n.actorName} ` : ''}
                      {describeNotification(n)} <span className="font-medium">{n.cardTitle}</span>
                    </span>
                    <div className="mt-0.5 text-xs text-latte">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run the test — expect pass.** `npm test -w client -- NotificationsBell`
  - Expected: `Test Files 1 passed (1)` · `Tests 2 passed (2)`.

- [ ] **Step 5: Import `NotificationsBell` in `client/src/components/AppShell.tsx`.** After the existing line:
  ```tsx
  import { Input } from './ui/Input';
  ```
  add:
  ```tsx
  import { NotificationsBell } from './NotificationsBell';
  ```

- [ ] **Step 6: Replace the placeholder notifications button in `client/src/components/AppShell.tsx`.** Replace this Section 8 block:
  ```tsx
            {/* Notifications slot — replaced by <NotificationsBell /> in section 11 */}
            <button type="button" aria-label="Notifications" className="text-latte hover:text-rust">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>
  ```
  with:
  ```tsx
            <NotificationsBell />
  ```

- [ ] **Step 7: Typecheck + build the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 8: Commit.**
  ```
  git add client/src/components/NotificationsBell.tsx client/src/components/NotificationsBell.test.tsx client/src/components/AppShell.tsx
  git commit -m "feat(notifications): NotificationsBell with badge, dropdown, mark-all-read, 60s poll" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.10: Profile hooks + SettingsPage

**Files:** `client/src/api/queries.ts` (modify), `client/src/pages/SettingsPage.tsx` (replace Section 8 stub)

`SettingsPage` keeps the `SettingsPage` **named** export that `App.tsx` imports. `useUpdateProfile` returns `Me` and writes it straight into the `['me']` cache so the shell avatar/menu update immediately.

- [ ] **Step 1: Append the profile hooks to the end of `client/src/api/queries.ts`.** (`Me` is already imported by Section 8; no new import needed.) Paste verbatim:
  ```ts
  export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (patch: { name?: string; avatarColor?: string; emailNotifications?: boolean }) =>
        api<Me>('/users/me', { method: 'PATCH', body: JSON.stringify(patch) }),
      onSuccess: (me) => qc.setQueryData(qk.me, me),
    });
  }

  export function useChangePassword() {
    return useMutation({
      mutationFn: (input: { currentPassword: string; newPassword: string }) =>
        api<void>('/users/me/password', { method: 'POST', body: JSON.stringify(input) }),
    });
  }
  ```

- [ ] **Step 2: Replace `client/src/pages/SettingsPage.tsx` (Section 8 stub) with the full page.** Full file:
  ```tsx
  import { useEffect, useState, type FormEvent } from 'react';
  import { LABEL_HEX, type LabelColor } from '@shared/types';
  import { useMe, useUpdateProfile, useChangePassword } from '../api/queries';
  import { ApiError } from '../api/client';

  const COLORS: LabelColor[] = ['coral', 'amber', 'olive', 'teal', 'blue', 'purple', 'pink', 'gray'];

  export function SettingsPage() {
    const me = useMe();
    const updateProfile = useUpdateProfile();
    const changePassword = useChangePassword();

    const [name, setName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pwOk, setPwOk] = useState(false);

    useEffect(() => {
      if (me.data) setName((n) => (n === '' ? me.data!.name : n));
    }, [me.data]);

    if (!me.data) return <div className="p-6 text-latte">Loading…</div>;
    const user = me.data;

    function saveName() {
      const trimmed = name.trim();
      if (trimmed && trimmed !== user.name) updateProfile.mutate({ name: trimmed });
    }
    function submitPassword(e: FormEvent) {
      e.preventDefault();
      setPwOk(false);
      changePassword.mutate(
        { currentPassword, newPassword },
        {
          onSuccess: () => {
            setPwOk(true);
            setCurrentPassword('');
            setNewPassword('');
          },
        },
      );
    }

    return (
      <div className="mx-auto max-w-lg px-6 py-8">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>

        <section className="mt-6">
          <label htmlFor="settings-name" className="block text-sm font-medium text-rust">
            Display name
          </label>
          <input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="mt-1 w-full rounded-md border border-sand bg-paper px-3 py-2 text-ink outline-none focus:border-coral"
          />
        </section>

        <section className="mt-6">
          <span className="block text-sm font-medium text-rust">Avatar color</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={user.avatarColor === c}
                onClick={() => updateProfile.mutate({ avatarColor: c })}
                style={{ backgroundColor: LABEL_HEX[c] }}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-cream ${
                  user.avatarColor === c ? 'ring-ink' : 'ring-transparent'
                }`}
              />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={user.emailNotifications}
              onChange={() => updateProfile.mutate({ emailNotifications: !user.emailNotifications })}
            />
            Email me notifications
          </label>
        </section>

        <form onSubmit={submitPassword} className="mt-8 border-t border-sand pt-6">
          <h2 className="text-lg font-semibold text-ink">Change password</h2>
          <label htmlFor="cur-pw" className="mt-3 block text-sm font-medium text-rust">
            Current password
          </label>
          <input
            id="cur-pw"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-sand bg-paper px-3 py-2 text-ink outline-none focus:border-coral"
          />
          <label htmlFor="new-pw" className="mt-3 block text-sm font-medium text-rust">
            New password
          </label>
          <input
            id="new-pw"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-sand bg-paper px-3 py-2 text-ink outline-none focus:border-coral"
          />
          {changePassword.isError && (
            <p className="mt-2 text-sm text-red-700">
              {changePassword.error instanceof ApiError
                ? changePassword.error.message
                : 'Something went wrong'}
            </p>
          )}
          {pwOk && <p className="mt-2 text-sm text-green-700">Password changed.</p>}
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="mt-4 rounded-md bg-coral px-4 py-2 font-medium text-paper hover:bg-rust disabled:opacity-50"
          >
            {changePassword.isPending ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 3: Typecheck + build the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 4: Manual verify.** `npm run dev`; log in. Open the avatar menu → **Settings**:
  - Change the display name, click outside → the header avatar/menu name updates (the `['me']` cache is rewritten).
  - Click a different avatar color swatch → the ring moves and the header avatar recolors.
  - Toggle **Email me notifications** off/on.
  - Change password: wrong current password → an inline error; correct current + a valid new one → "Password changed." and the fields clear.
  - Stop with Ctrl-C.

- [ ] **Step 5: Commit.**
  ```
  git add client/src/api/queries.ts client/src/pages/SettingsPage.tsx
  git commit -m "feat(settings): profile hooks + SettingsPage (name, avatar, email toggle, password)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 11.11: Admin hooks + AdminPage

**Files:** `client/src/api/queries.ts` (modify), `client/src/pages/AdminPage.tsx` (replace Section 8 stub)

`AdminPage` keeps the `AdminPage` **named** export that `App.tsx` imports. Consumes the admin endpoints pinned in the boundary notes (Section 7 provides them): members overview, invites, member patch/reset-password, plus archived-boards recovery (restore) and permanent purge. `AdminOverview` is a local composed type for the `GET /api/admin/members` shape (there is no shared DTO for it), declared in `queries.ts` — mirroring how Section 8 declared `CardDetailDto` there.

- [ ] **Step 1: Import `UserPublic` in `client/src/api/queries.ts`.** After the existing line:
  ```ts
  import { api } from './client';
  ```
  add:
  ```ts
  import type { UserPublic } from '@shared/types';
  ```

- [ ] **Step 2: Append the admin overview type + hooks to the end of `client/src/api/queries.ts`.** Paste verbatim:
  ```ts
  export interface AdminOverview {
    members: UserPublic[];
    diskUsageBytes: number;
    emailConfigured: boolean;
  }

  export function useAdminMembers() {
    return useQuery({
      queryKey: ['admin', 'members'],
      queryFn: () => api<AdminOverview>('/admin/members'),
    });
  }

  export function useArchivedBoards() {
    return useQuery({
      queryKey: ['admin', 'archived-boards'],
      queryFn: () => api<BoardSummary[]>('/admin/archived-boards'),
    });
  }

  export function useCreateInvite() {
    return useMutation({
      mutationFn: (email: string) =>
        api<{ link: string }>('/admin/invites', { method: 'POST', body: JSON.stringify({ email }) }),
    });
  }

  export function usePatchMember() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (input: { userId: string; patch: { deactivated?: boolean; isAdmin?: boolean } }) =>
        api<void>(`/admin/members/${input.userId}`, {
          method: 'PATCH',
          body: JSON.stringify(input.patch),
        }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'members'] }),
    });
  }

  export function useResetMemberPassword() {
    return useMutation({
      mutationFn: (userId: string) =>
        api<{ link: string }>(`/admin/members/${userId}/reset-password`, { method: 'POST' }),
    });
  }

  export function useRestoreBoard() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (boardId: string) =>
        api<void>('/admin/restore', {
          method: 'POST',
          body: JSON.stringify({ entity: 'board', id: boardId }),
        }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['admin', 'archived-boards'] });
        qc.invalidateQueries({ queryKey: qk.boards });
      },
    });
  }

  export function usePurgeBoard() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (boardId: string) =>
        api<void>('/admin/purge', {
          method: 'POST',
          body: JSON.stringify({ entity: 'board', id: boardId }),
        }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['admin', 'archived-boards'] });
        qc.invalidateQueries({ queryKey: qk.boards });
      },
    });
  }
  ```

- [ ] **Step 3: Replace `client/src/pages/AdminPage.tsx` (Section 8 stub) with the full page.** Full file:
  ```tsx
  import { useState } from 'react';
  import type { UserPublic, BoardSummary } from '@shared/types';
  import {
    useAdminMembers,
    useArchivedBoards,
    useCreateInvite,
    usePatchMember,
    useResetMemberPassword,
    useRestoreBoard,
    usePurgeBoard,
  } from '../api/queries';

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function CopyField({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
      <div className="mt-1 flex items-center gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 rounded border border-sand bg-cream px-2 py-1 text-xs text-ink"
        />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded border border-sand px-2 py-1 text-xs text-rust hover:border-coral"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    );
  }

  export function AdminPage() {
    const overview = useAdminMembers();
    const archived = useArchivedBoards();
    const createInvite = useCreateInvite();
    const patchMember = usePatchMember();
    const resetPassword = useResetMemberPassword();
    const restoreBoard = useRestoreBoard();
    const purgeBoard = usePurgeBoard();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [resetLinks, setResetLinks] = useState<Record<string, string>>({});

    const data = overview.data;

    function purge(board: BoardSummary) {
      if (window.confirm(`Permanently delete "${board.name}"? This cannot be undone.`)) {
        purgeBoard.mutate(board.id);
      }
    }
    function sendInvite() {
      const email = inviteEmail.trim();
      if (!email) return;
      createInvite.mutate(email, {
        onSuccess: (res) => {
          setInviteLink(res.link);
          setInviteEmail('');
        },
      });
    }
    function reset(userId: string) {
      resetPassword.mutate(userId, {
        onSuccess: (res) => setResetLinks((prev) => ({ ...prev, [userId]: res.link })),
      });
    }

    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-ink">Admin</h1>

        {data && !data.emailConfigured && (
          <div className="mt-4 rounded-md border border-sun bg-sun/15 px-4 py-3 text-sm text-rust">
            Email isn't configured — invite and reset links must be shared by copy-link.
          </div>
        )}

        <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
          <h2 className="text-lg font-semibold text-ink">Invite a teammate</h2>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="flex-1 rounded-md border border-sand bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-coral"
            />
            <button
              type="button"
              onClick={sendInvite}
              disabled={!inviteEmail.trim() || createInvite.isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-paper hover:bg-rust disabled:opacity-50"
            >
              {createInvite.isPending ? 'Creating…' : 'Send invite'}
            </button>
          </div>
          {inviteLink && (
            <div className="mt-3">
              <p className="text-xs text-latte">
                {data?.emailConfigured
                  ? 'This invite link was emailed. You can also copy it to share directly:'
                  : 'Copy this invite link to share (email is not configured):'}
              </p>
              <CopyField value={inviteLink} />
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
          <h2 className="text-lg font-semibold text-ink">Members</h2>
          {overview.isLoading && <p className="mt-2 text-latte">Loading…</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-latte">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.members ?? []).map((m: UserPublic) => (
                  <tr key={m.id} className="border-t border-sand align-top">
                    <td className="py-2 text-ink">{m.name}</td>
                    <td className="py-2 text-latte">{m.email}</td>
                    <td className="py-2">{m.isAdmin ? 'Admin' : 'Member'}</td>
                    <td className="py-2">
                      {m.deactivated ? <span className="text-red-700">Deactivated</span> : 'Active'}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            patchMember.mutate({ userId: m.id, patch: { deactivated: !m.deactivated } })
                          }
                          className="text-xs text-rust hover:underline"
                        >
                          {m.deactivated ? 'Reactivate' : 'Deactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchMember.mutate({ userId: m.id, patch: { isAdmin: !m.isAdmin } })
                          }
                          className="text-xs text-rust hover:underline"
                        >
                          {m.isAdmin ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          type="button"
                          onClick={() => reset(m.id)}
                          className="text-xs text-rust hover:underline"
                        >
                          Reset password
                        </button>
                      </div>
                      {resetLinks[m.id] && <CopyField value={resetLinks[m.id]} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
          <h2 className="text-lg font-semibold text-ink">Storage</h2>
          <p className="mt-1 text-sm text-latte">
            {data ? `${formatBytes(data.diskUsageBytes)} of attachments stored.` : 'Loading…'}
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-sand bg-paper p-4">
          <h2 className="text-lg font-semibold text-ink">Archived boards</h2>
          {archived.isLoading && <p className="mt-2 text-sm text-latte">Loading…</p>}
          {archived.data && archived.data.length === 0 && (
            <p className="mt-2 text-sm text-latte">No archived boards.</p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {(archived.data ?? []).map((b: BoardSummary) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-md border border-sand bg-cream px-3 py-2"
              >
                <span className="truncate text-sm text-ink">{b.name}</span>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => restoreBoard.mutate(b.id)}
                    className="text-xs text-rust hover:underline"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => purge(b)}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Purge
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }
  ```

- [ ] **Step 4: Typecheck + build the client — expect pass.** `npm run build -w client`
  - Expected: `tsc -b` no errors; Vite prints `✓ built in …`.

- [ ] **Step 5: Manual verify.** `npm run dev`; log in as the seeded admin. Open the avatar menu → **Admin**:
  - In dev (no `RESEND_API_KEY`/`EMAIL_FROM`), the **email-not-configured** notice is shown ("Email isn't configured — invite and reset links must be shared by copy-link.").
  - Enter an email → **Send invite** → a copy-able invite link appears; **Copy** flips to "Copied".
  - The members table lists the admin (and any others) with Role/Status; **Deactivate**/**Reactivate**, **Promote**/**Demote**, and **Reset password** (which reveals a copy-able reset link) all work and the row refreshes.
  - **Storage** shows the attachments total (e.g. after uploading a file on a card).
  - **Archived boards**: archive a board (Section 10 board menu), reload Admin → it appears here; **Restore** returns it to the boards list; **Purge** (after confirming the `window.confirm`) permanently removes it.
  - Stop with Ctrl-C.

- [ ] **Step 6: Commit.**
  ```
  git add client/src/api/queries.ts client/src/pages/AdminPage.tsx
  git commit -m "feat(admin): admin hooks + AdminPage (invite, members, disk usage, email notice, archived-boards restore/purge)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Section verification (all must hold before section 12)

- [ ] `npm test -w client -- mentions` → `Tests 9 passed (9)`.
- [ ] `npm test -w client -- NotificationsBell` → `Tests 2 passed (2)`.
- [ ] `npm test -w client` → every client test file passes (Sections 8–11), exit 0.
- [ ] `npm run build -w client` → `tsc -b` clean (no `any`, no unused locals/params), `client/dist` produced.
- [ ] Manual (against `npm run dev`, seeded admin): a card opens at `/b/:boardId/c/:cardId` (deep-linkable, Esc/backdrop/✕ closes to `/b/:boardId`); title inline-edit + description save-on-blur persist; LabelPicker toggles labels and creates/renames/deletes board labels; DueDatePicker sets/clears the date; AssigneePicker toggles assignees; Checklist adds/toggles/edits/deletes with `x/y` progress; Attachments enforce the 20 MB cap, download, and delete; Comments post with a working `@mention` picker rendered as `@Name`; ActivityLog is collapsed by default and expands; Archive card removes it from the board.
- [ ] Manual: the NotificationsBell shows an unread badge, its dropdown items link to cards, "Mark all read" clears the badge, and it refreshes on its 60s poll.
- [ ] Manual: SettingsPage updates name/avatar-color/email-toggle (header avatar reflects the change) and changes the password (wrong current → inline error).
- [ ] Manual: AdminPage shows the email-not-configured notice when email is unset, issues copy-able invite/reset links, edits members (deactivate/promote/reset), reports disk usage (total attachment bytes), and lists archived boards with working Restore + Purge (purge behind a confirm).

### Notes for the Section 7 (admin routes) author

This client section consumes the admin API shapes Section 7 pins: `GET /api/admin/members` → `{ members: UserPublic[]; diskUsageBytes: number; emailConfigured: boolean }` (drives the members table, the Storage total, and the email-not-configured notice), `GET /api/admin/archived-boards` → `BoardSummary[]`, `POST /api/admin/restore {entity:'board', id}`, and `POST /api/admin/purge {entity:'board', id}` (drive the Archived boards Restore/Purge buttons). Match these route shapes verbatim.


---

## Section 12: E2E tests, Docker finalization, README

Adds the three Playwright end-to-end specs (`journey`, `livesync`, `auth`) on top of the Section 1 `smoke.spec.ts`, finalizes the multi-stage Dockerfile (node:22-alpine, native `better-sqlite3` build, `/data` volume, HEALTHCHECK), and writes the production `README.md`. This section runs LAST: sections 1–11 have already built the full server + client, so the E2E specs drive the real built app end to end (they are red only if a section 8–11 UI handle drifts from the contract below, which the executor reconciles here).

### Boundary notes / assumed artifacts (all lower- or equal-numbered, already executed)

- **Playwright harness** comes from Section 1: root dev-dep `@playwright/test`, `playwright.config.ts` (webServer builds + starts the real server on `:3000`, serving `client/dist`), `e2e/smoke.spec.ts`, and `npx playwright install chromium` already run. This section **modifies** `playwright.config.ts` (adds bootstrap env + serial workers) and **adds** specs + `e2e/helpers.ts`.
- **Backend contracts** (Sections 3–7) used directly over HTTP by the specs: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/accept-invite`, `POST /api/auth/reset-password`, `POST /api/admin/invites {email}` → `{ link }`, `GET /api/admin/members`, `POST /api/admin/members/:id/reset-password` → `{ link }`, `POST /api/cards/:id/assignees {userId}`, `GET /api/cards/:id` → `CardDetailDto`. The bootstrap admin's display name is `ADMIN_EMAIL.split('@')[0]` (Section 3 `firstRunBootstrap`). Self-assign and self-comment do **not** create a notification (Sections 5/6), so the journey's "notification appears" is produced by a *second* user assigning the admin.
- **Written client UI** (Sections 8–9) exercised directly: `LoginPage` (`Email`/`Password` labels, "Sign in"), `AcceptInvitePage` (`Name`/`Password`, "Join"), `ResetPasswordPage` (`New password`, "Save password"), `HomePage` + `CreateBoardDialog` ("Create your first board" / "+ New board" → `Board name`, visibility `team`/`private` buttons, "Create board").
- **Docker draft** comes from Section 1 (`Dockerfile`, `.dockerignore`). This section **replaces** the `Dockerfile` and finalizes `README.md` (Section 1 wrote a stub).

### UI selector contract for Sections 10–11 (the E2E acceptance surface)

`journey.spec.ts` and `livesync.spec.ts` drive the board/card UI built by Sections 10–11. These selectors are reconciled to the components those sections **already build** — no test-only `data-testid`s were added there, so the specs target the accessible roles, placeholders, and one structural width class those components actually expose. All board selectors are centralized in `e2e/helpers.ts` and the card-detail selectors inline in `journey.spec.ts`, so any drift is fixed in one place:

| Area | Handle (as built in Sections 10–11) |
|---|---|
| List column root | the `w-72` `div` that contains the list's name **button**; located via that button (helper `getColumn`) |
| Add a list | a `+ Add a list` button reveals a text input `placeholder="List name…"`; Enter creates the list and the composer stays open |
| Add a card | a per-column `+ Add a card` button reveals a `textarea` `placeholder="Card title…"`; Enter creates the card and the composer stays open |
| Card tile | a clickable card whose title `<p>` text is the card title (located via `getByText`); click → navigates to `/b/:id/c/:cardId` |
| Rename list inline | clicking the list-name `button` swaps it for an autofocused rename `input` (no `aria-label` in Section 10); Enter saves |
| Card detail | opens as `role="dialog"` (its `aria-label` is the card title); the title is editable via `input[aria-label="Card title"]` |
| Labels | rendered inline in the `Labels` field (`heading` "Labels"); each label is a `checkbox` (8 auto-seeded), and checking one assigns it |
| Due date | always-visible inline `input[type="date"]` in the `Due date` field |
| Assignees | rendered inline in the `Assignees` field (`heading` "Assignees"); each member is a `checkbox` (the label shows the member name) |
| Checklist | text input `placeholder="Add an item"`; Enter adds an item |
| Comment | `textarea` `placeholder="Write a comment… use @ to mention"`; a `/comment|post|send/i` button submits |
| Notifications bell | button `aria-label="Notifications"`; opening it lists notifications whose text includes the card title |

### Files

**Create**
- `e2e/helpers.ts` — shared login/board/list/card/drag helpers + constants
- `e2e/journey.spec.ts`
- `e2e/livesync.spec.ts`
- `e2e/auth.spec.ts`

**Modify**
- `playwright.config.ts` — bootstrap env vars, absolute temp `DATA_DIR`, serial workers
- `Dockerfile` — replace with node:22-alpine multi-stage + native build + volume + HEALTHCHECK
- `README.md` — replace Section 1 stub with the full production README

---

### Task 12.1: Playwright config finalization + shared E2E helpers

**Files:** `playwright.config.ts` (modify), `e2e/helpers.ts` (create)

- [ ] **Step 1: Replace `playwright.config.ts`** with the finalized config (full file). Changes vs. Section 1: an absolute temp `DATA_DIR` (avoids CWD/gitignore surprises when `-w server` changes the working dir), the bootstrap + session env the auth stack needs, and serial single-worker execution so the three stateful specs never race on the shared SQLite DB:
  ```ts
  import { defineConfig } from '@playwright/test';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';

  const E2E_DATA_DIR = join(tmpdir(), 'company-trello-e2e');

  export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    reporter: 'list',
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'retain-on-failure',
    },
    webServer: {
      command: 'npm run build && npm run start -w server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PORT: '3000',
        DATA_DIR: E2E_DATA_DIR,
        NODE_ENV: 'production',
        SESSION_SECRET: 'e2e-test-secret',
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_PASSWORD: 'admin-password-123',
        APP_URL: 'http://localhost:3000',
      },
    },
  });
  ```
  Notes: `DATA_DIR` is a fixed OS-temp path (outside the repo). Specs use per-run-unique board names and emails (helper `uniq()` below), so a reused/persisted DB across local reruns never collides. `NODE_ENV=production` makes session cookies `Secure`; Chromium sends `Secure` cookies over `http://localhost` (localhost carve-out), so auth works. `APP_URL` matches `baseURL` so `{ link }` values from the admin API are same-origin and navigable.

- [ ] **Step 2: Verify the config still loads and the Section 1 smoke spec passes under it.** Run `npm run e2e -- smoke`.
  - Expected: Playwright runs the webServer (`npm run build` then `server listening on http://0.0.0.0:3000`), waits for `/api/health`, then `Running 2 tests using 1 worker` and `2 passed`. (Confirms the new env + `workers: 1` config is valid before adding specs.)

- [ ] **Step 3: Create `e2e/helpers.ts`** (full file). Shared constants + UI helpers used by all three specs. Board/list/card helpers encapsulate every Section 10–11 selector so drift is fixed in one place:
  ```ts
  import { expect, type Page, type Locator } from '@playwright/test';

  export const ADMIN = { email: 'admin@example.com', password: 'admin-password-123' };

  /** Per-invocation unique suffix so specs never collide on a reused DB. */
  export function uniq(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  export async function login(page: Page, email = ADMIN.email, password = ADMIN.password): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => url.pathname === '/');
  }

  async function openCreateBoardDialog(page: Page): Promise<void> {
    const firstBtn = page.getByRole('button', { name: /create your first board/i });
    const newTile = page.getByRole('button', { name: /\+ new board/i });
    await Promise.race([
      firstBtn.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
      newTile.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
    ]);
    if (await firstBtn.isVisible().catch(() => false)) await firstBtn.click();
    else await newTile.click();
    await page.getByLabel('Board name').waitFor({ state: 'visible' });
  }

  /** Creates a board via the Home create dialog and returns its id (from the URL). */
  export async function createBoard(
    page: Page,
    opts: { name: string; visibility?: 'team' | 'private' },
  ): Promise<string> {
    await openCreateBoardDialog(page);
    await page.getByLabel('Board name').fill(opts.name);
    if (opts.visibility === 'private') {
      await page.getByRole('button', { name: 'private', exact: true }).click();
    }
    await page.getByRole('button', { name: /create board/i }).click();
    await page.waitForURL(/\/b\/[^/]+$/);
    return page.url().match(/\/b\/([^/?#]+)/)![1];
  }

  export function getColumn(page: Page, listName: string): Locator {
    // Section 10's ListColumn has no testid; the column root is the `w-72` div
    // that contains the list's name *button* (the drag handle). Filtering by that
    // button pins us to the one real column (the add-list composer is also w-72
    // but never contains a list-name button).
    return page
      .locator('div.w-72')
      .filter({ has: page.getByRole('button', { name: listName, exact: true }) });
  }

  export function getCard(page: Page, title: string): Locator {
    // Section 10's CardTile has no testid; its title lives in a <p>, so match by
    // text (card titles are uniq() so this is unambiguous). Clicking the <p>
    // bubbles to the card div's onClick, which opens the card.
    return page.getByText(title);
  }

  export async function addList(page: Page, name: string): Promise<void> {
    // The add-list composer collapses to a "+ Add a list" button and, once open,
    // stays open after Enter (Section 10 clears the field for rapid entry) — so
    // only click the button when the input isn't already showing.
    const composer = page.getByPlaceholder(/list name/i);
    if (!(await composer.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /add a list/i }).click();
    }
    await composer.fill(name);
    await composer.press('Enter');
    await page.getByRole('button', { name, exact: true }).waitFor({ state: 'visible' });
  }

  export async function addCard(page: Page, listName: string, title: string): Promise<void> {
    const column = getColumn(page, listName);
    // Each column's card composer collapses to a "+ Add a card" button and also
    // stays open after Enter — open it only when the title field isn't showing.
    const composer = column.getByPlaceholder(/card title/i);
    if (!(await composer.isVisible().catch(() => false))) {
      await column.getByRole('button', { name: /add a card/i }).click();
    }
    await composer.fill(title);
    await composer.press('Enter');
    await column.getByText(title).waitFor({ state: 'visible' });
  }

  export async function openCard(page: Page, title: string): Promise<{ boardId: string; cardId: string }> {
    await getCard(page, title).click();
    await page.waitForURL(/\/c\/[^/]+/);
    const m = page.url().match(/\/b\/([^/?#]+)\/c\/([^/?#]+)/)!;
    await expect(page.getByRole('dialog')).toBeVisible();
    return { boardId: m[1], cardId: m[2] };
  }

  /** Drags a card onto a target column with the incremental moves dnd-kit's PointerSensor needs. */
  export async function dragCardToColumn(page: Page, cardTitle: string, targetListName: string): Promise<void> {
    const cardBox = await getCard(page, cardTitle).boundingBox();
    const targetBox = await getColumn(page, targetListName).boundingBox();
    if (!cardBox || !targetBox) throw new Error('drag source or target not found');
    const from = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
    const to = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 8, from.y + 8, { steps: 5 });
    await page.mouse.move(to.x, to.y, { steps: 15 });
    await page.mouse.move(to.x, to.y + 4, { steps: 5 });
    await page.mouse.up();
  }

  export async function renameList(page: Page, oldName: string, newName: string): Promise<void> {
    // Clicking the list-name button swaps it for an autofocused rename input
    // (Section 10 gives it no aria-label), so target the focused input directly.
    await getColumn(page, oldName).getByRole('button', { name: oldName, exact: true }).click();
    const input = page.locator('input:focus');
    await input.fill(newName);
    await input.press('Enter');
    await page.getByRole('button', { name: newName, exact: true }).waitFor({ state: 'visible' });
  }
  ```

- [ ] **Step 4: Type-check the helpers by listing the (still-only-smoke) suite.** Run `npm run e2e -- --list`.
  - Expected: Playwright transpiles `e2e/helpers.ts` + specs with no syntax/transpile error and prints the smoke tests, e.g. `Total: 2 tests in 1 file` (helpers.ts is imported-only, not a spec, so it lists nothing itself). No `webServer` starts for `--list`.

- [ ] **Step 5: Commit.**
  ```
  git add playwright.config.ts e2e/helpers.ts && git commit -m "test(e2e): bootstrap-env playwright config and shared helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 12.2: journey.spec.ts — full happy-path board journey

**Files:** `e2e/journey.spec.ts` (create)

The single flagship journey: build a board, drag a card, edit every card-detail facet, comment, then receive a notification. Because self-assign and self-comment never notify (Sections 5/6), the notification is produced by a second user (Bob) — invited via the admin API and accepted in a throwaway context — posting a comment on the admin's card. Every card-detail mutation is asserted authoritatively via `GET /api/cards/:id`.

- [ ] **Step 1: Create `e2e/journey.spec.ts`** (full file):
  ```ts
  import { test, expect } from '@playwright/test';
  import { uniq, login, createBoard, addList, addCard, getColumn, dragCardToColumn, openCard } from './helpers';

  test('build a board, drag a card, edit its detail, comment, and receive a notification', async ({ page, browser }) => {
    const boardName = uniq('Journey');
    const cardTitle = uniq('Design homepage');

    // 1. Log in as the bootstrap admin, create a team board (default), land on it.
    await login(page);
    const boardId = await createBoard(page, { name: boardName });

    // 2. Two lists, two cards in "To Do".
    await addList(page, 'To Do');
    await addList(page, 'Doing');
    await addCard(page, 'To Do', cardTitle);
    await addCard(page, 'To Do', uniq('Write copy'));

    // 3. Drag the card "To Do" -> "Doing"; confirm it landed in the target column.
    await dragCardToColumn(page, cardTitle, 'Doing');
    await expect(getColumn(page, 'Doing').getByText(cardTitle)).toBeVisible();

    // 4. Open the card detail.
    const { cardId } = await openCard(page, cardTitle);
    const dialog = page.getByRole('dialog');
    const me = await (await page.request.get('/api/auth/me')).json();

    // Section 11 renders every card-detail facet inline (no popovers), each in a
    // <section> titled by an <h3> heading. Scope the checkbox pickers to their own
    // field so a "first checkbox" never picks the wrong list.
    const field = (name: string) =>
      dialog.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });

    // 5a. Labels -> 8 are auto-seeded on board creation; check the first to assign it.
    await field('Labels').getByRole('checkbox').first().check();

    // 5b. Assignees -> self is the only member; check it (self-assign, which does not notify).
    await field('Assignees').getByRole('checkbox').first().check();

    // 5c. Due date -> always-visible inline date input.
    await dialog.locator('input[type="date"]').fill('2026-12-31');

    // 5d. Checklist item.
    const checkInput = dialog.getByPlaceholder('Add an item');
    await checkInput.fill('Write tests');
    await checkInput.press('Enter');

    // 5e. Comment.
    const commentInput = dialog.getByPlaceholder(/write a comment/i);
    await commentInput.fill('Looks good to me');
    await dialog.getByRole('button', { name: /comment|post|send/i }).first().click();
    await expect(dialog.getByText('Looks good to me')).toBeVisible();

    // 6. Every card-detail mutation persisted (authoritative API view).
    await expect
      .poll(async () => {
        const card = await (await page.request.get(`/api/cards/${cardId}`)).json();
        return {
          labels: card.labelIds.length,
          due: card.dueDate,
          assigned: card.assigneeIds.includes(me.id),
          checklist: card.checklist.length,
          comments: card.comments.length,
        };
      })
      .toEqual({ labels: 1, due: '2026-12-31', assigned: true, checklist: 1, comments: 1 });

    // 7. Second user (Bob) invited via the admin API, accepted in a throwaway context,
    //    comments on the admin's card -> the admin is the creator+assignee -> notified.
    const bobEmail = `${uniq('bob')}@example.com`;
    const invite = await page.request.post('/api/admin/invites', { data: { email: bobEmail } });
    expect(invite.ok()).toBeTruthy();
    const token = (await invite.json()).link.match(/\/invite\/([^/?#]+)/)![1];

    const bob = await browser.newContext();
    const accepted = await bob.request.post('/api/auth/accept-invite', {
      data: { token, name: 'Bob', password: 'bob-password-123' },
    });
    expect(accepted.ok()).toBeTruthy();
    const bobComment = await bob.request.post(`/api/cards/${cardId}/comments`, {
      data: { body: 'Nice work from Bob' },
    });
    expect(bobComment.ok()).toBeTruthy();
    await bob.close();

    // 8. The admin has a notification for this card (backend), and the bell surfaces it.
    //    Assert on Home, where no card titles are rendered, so the title is unambiguous.
    await expect
      .poll(async () => {
        const list = await (await page.request.get('/api/notifications')).json();
        return list.some((n: { cardId: string }) => n.cardId === cardId);
      })
      .toBe(true);

    await page.goto('/');
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByText(cardTitle)).toBeVisible();
  });
  ```

- [ ] **Step 2: Run the journey spec.** `npm run e2e -- journey`
  - Expected: the webServer builds + starts, then `Running 1 test using 1 worker` and `1 passed`. A real failure here is a Section 10–11 selector drift — reconcile the failing handle against the "UI selector contract" table above (the assertion message names the exact locator), then re-run until green.

- [ ] **Step 3: Commit.**
  ```
  git add e2e/journey.spec.ts && git commit -m "test(e2e): full board journey with drag, card-detail edits, and notification" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 12.3: livesync.spec.ts — two clients, one board, live propagation

**Files:** `e2e/livesync.spec.ts` (create)

Two independent browser contexts (both logged in as the admin — live sync is per-room, not per-user) sit on the same board. A's create + move and B's rename each propagate to the other client via the `board:changed` room broadcast with **no page reload**. Assertions use a bounded timeout; the spec's target is under a second (debounce ~150 ms), the timeout only guards CI jitter.

- [ ] **Step 1: Create `e2e/livesync.spec.ts`** (full file):
  ```ts
  import { test, expect } from '@playwright/test';
  import { uniq, login, createBoard, addList, addCard, getColumn, dragCardToColumn, renameList } from './helpers';

  test('two clients on one board see each other changes without reloading', async ({ browser }) => {
    const boardName = uniq('LiveSync');
    const cardTitle = uniq('Sync card');

    // Context A builds a board with two lists.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await login(pageA);
    const boardId = await createBoard(pageA, { name: boardName });
    await addList(pageA, 'Alpha');
    await addList(pageA, 'Beta');

    // Context B opens the same board (a second admin session -> second socket in the room).
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await login(pageB);
    await pageB.goto(`/b/${boardId}`);
    await expect(getColumn(pageB, 'Alpha')).toBeVisible();

    // A creates a card in Alpha -> B sees it live.
    await addCard(pageA, 'Alpha', cardTitle);
    await expect(getColumn(pageB, 'Alpha').getByText(cardTitle)).toBeVisible({ timeout: 3000 });

    // A moves the card Alpha -> Beta -> B sees the move live.
    await dragCardToColumn(pageA, cardTitle, 'Beta');
    await expect(getColumn(pageB, 'Beta').getByText(cardTitle)).toBeVisible({ timeout: 3000 });

    // B renames a list -> A sees the new name live (the list name is a button).
    const renamed = uniq('Gamma');
    await renameList(pageB, 'Beta', renamed);
    await expect(pageA.getByRole('button', { name: renamed, exact: true })).toBeVisible({ timeout: 3000 });

    await ctxA.close();
    await ctxB.close();
  });
  ```

- [ ] **Step 2: Run the livesync spec.** `npm run e2e -- livesync`
  - Expected: `Running 1 test using 1 worker` then `1 passed`. If B never sees A's card, confirm both pages joined room `board:{id}` (Section 8 `useBoardChannel` fires `board:join` on mount) and the server emits `board:changed` after each mutation (Section 7).

- [ ] **Step 3: Commit.**
  ```
  git add e2e/livesync.spec.ts && git commit -m "test(e2e): live sync across two board clients" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 12.4: auth.spec.ts — invite, accept, private isolation, password reset

**Files:** `e2e/auth.spec.ts` (create)

One cohesive auth flow (a single test so the invited member is shared state, no cross-test plumbing): admin invites (copy-link via the admin API), the member accepts through the real `AcceptInvitePage`, a private board stays invisible to that non-member (Home + API), then the admin issues a reset link and the member sets a new password through the real `ResetPasswordPage`. Depends only on **written** UI (Sections 8–9) plus the auth/board/admin backends.

- [ ] **Step 1: Create `e2e/auth.spec.ts`** (full file):
  ```ts
  import { test, expect } from '@playwright/test';
  import { uniq, login, createBoard } from './helpers';

  test('invite copy-link + accept, private-board isolation, and admin password reset', async ({ page, browser }) => {
    const memberEmail = `${uniq('member')}@example.com`;
    const secretName = uniq('Secret');
    const firstPassword = 'member-password-1';
    const newPassword = 'member-password-2';

    // Admin logs in and creates a PRIVATE board.
    await login(page);
    const secretId = await createBoard(page, { name: secretName, visibility: 'private' });

    // Admin invites the member; the copy-link path returns the invite link.
    const invite = await page.request.post('/api/admin/invites', { data: { email: memberEmail } });
    expect(invite.ok()).toBeTruthy();
    const inviteLink = (await invite.json()).link as string;
    expect(inviteLink).toContain('/invite/');

    // Member accepts in a fresh context via the real accept-invite UI.
    const memberCtx = await browser.newContext();
    const memberPage = await memberCtx.newPage();
    await memberPage.goto(inviteLink);
    await memberPage.getByLabel('Name').fill('Mel Member');
    await memberPage.getByLabel('Password').fill(firstPassword);
    await memberPage.getByRole('button', { name: /join/i }).click();
    await memberPage.waitForURL((url) => url.pathname === '/');
    const meNew = await (await memberPage.request.get('/api/auth/me')).json();
    expect(meNew.email).toBe(memberEmail);

    // Wait for the member's Home boards to load, then assert the private board is absent (UI + API).
    await expect(
      memberPage.getByRole('button', { name: /create your first board|\+ new board/i }),
    ).toBeVisible();
    await expect(memberPage.getByText(secretName)).toHaveCount(0);
    const denied = await memberPage.request.get(`/api/boards/${secretId}`);
    expect(denied.ok()).toBeFalsy();
    expect([403, 404]).toContain(denied.status());

    // Admin resets the member's password -> single-use reset link.
    const membersBody = await (await page.request.get('/api/admin/members')).json();
    const roster = Array.isArray(membersBody) ? membersBody : membersBody.members;
    const memberRow = roster.find((m: { email: string }) => m.email === memberEmail);
    expect(memberRow).toBeTruthy();
    const reset = await page.request.post(`/api/admin/members/${memberRow.id}/reset-password`);
    expect(reset.ok()).toBeTruthy();
    const resetLink = (await reset.json()).link as string;
    expect(resetLink).toContain('/reset/');

    // Member sets a new password via the real reset UI, landing logged in.
    const resetCtx = await browser.newContext();
    const resetPage = await resetCtx.newPage();
    await resetPage.goto(resetLink);
    await resetPage.getByLabel('New password').fill(newPassword);
    await resetPage.getByRole('button', { name: /save password/i }).click();
    await resetPage.waitForURL((url) => url.pathname === '/');

    // The new password works from a clean session.
    const verifyCtx = await browser.newContext();
    const verifyPage = await verifyCtx.newPage();
    await login(verifyPage, memberEmail, newPassword);
    await expect(verifyPage).toHaveURL(/\/$/);

    await memberCtx.close();
    await resetCtx.close();
    await verifyCtx.close();
  });
  ```

- [ ] **Step 2: Run the auth spec.** `npm run e2e -- auth`
  - Expected: `Running 1 test using 1 worker` then `1 passed`. If `GET /api/admin/members` shape differs, the `Array.isArray(...) ? ... : .members` guard already handles both an array and a `{ members }` envelope; a `memberRow` failure means the field is named differently — align it with the Section 7/11 response.

- [ ] **Step 3: Commit.**
  ```
  git add e2e/auth.spec.ts && git commit -m "test(e2e): invite/accept, private-board isolation, and password reset" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 12.5: Finalize the production Dockerfile (alpine + native build + volume + healthcheck)

**Files:** `Dockerfile` (replace the Section 1 draft)

Extends the Section 1 multi-stage design: switches both stages to `node:22-alpine`, adds the `node-gyp` toolchain so `better-sqlite3` (Section 2) compiles its native addon in the builder, declares the `/data` volume, adds a `HEALTHCHECK` on `/api/health`, and keeps the `tsx` runtime entry (the server tsconfig is `noEmit`, so there is no compiled JS to run). Builder and runtime share the same alpine/musl base, so the compiled addon copied in `node_modules` is ABI-compatible.

- [ ] **Step 1: Replace `Dockerfile`** with the finalized multi-stage build (full file):
  ```dockerfile
  # syntax=docker/dockerfile:1

  # --- Build stage: install workspaces (compiling better-sqlite3) + build the client ---
  FROM node:22-alpine AS builder
  WORKDIR /app

  # node-gyp toolchain for better-sqlite3's native addon.
  RUN apk add --no-cache python3 make g++

  COPY package.json package-lock.json ./
  COPY client/package.json ./client/package.json
  COPY server/package.json ./server/package.json
  RUN npm ci

  COPY . .
  RUN npm run build

  # --- Runtime stage: run the server via tsx, serving the built client from /app/client/dist ---
  FROM node:22-alpine AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=3000
  ENV DATA_DIR=/data

  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./package.json
  COPY --from=builder /app/package-lock.json ./package-lock.json
  COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
  COPY --from=builder /app/shared ./shared
  COPY --from=builder /app/server ./server
  COPY --from=builder /app/client/dist ./client/dist

  VOLUME ["/data"]
  EXPOSE 3000

  HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

  WORKDIR /app/server
  CMD ["npx", "tsx", "src/index.ts"]
  ```

- [ ] **Step 2: Build the image (skip gracefully if Docker is unavailable).**
  ```
  command -v docker >/dev/null 2>&1 && docker build -t company-trello . || echo "docker unavailable — skipping build (re-run on a Docker host before deploy)"
  ```
  - Expected (Docker present): both stages run; `apk add` installs python3/make/g++; `npm ci` compiles `better-sqlite3`; `npm run build` typechecks the server and emits `client/dist`; final line `naming to docker.io/library/company-trello` (or `writing image sha256:…`). Exit 0.
  - Expected (Docker absent): prints the skip message, exit 0. Note it in the section verification and re-run on a Docker host.

- [ ] **Step 3: Smoke-test the container (skip gracefully if Docker is unavailable).** A fresh volume is empty, so bootstrap needs `ADMIN_EMAIL`/`ADMIN_PASSWORD`, and prod needs `SESSION_SECRET`:
  ```
  if command -v docker >/dev/null 2>&1; then
    DATADIR="$(mktemp -d)"
    docker run -d --rm -p 3000:3000 \
      -e SESSION_SECRET=docker-smoke-secret \
      -e ADMIN_EMAIL=admin@example.com \
      -e ADMIN_PASSWORD=docker-smoke-pw-123 \
      -v "$DATADIR:/data" --name ct-smoke company-trello
    sleep 6
    curl -sf http://localhost:3000/api/health
    curl -s http://localhost:3000/ | grep -o "<title>company trello</title>"
    curl -s -X POST http://localhost:3000/api/auth/login \
      -H 'content-type: application/json' \
      -d '{"email":"admin@example.com","password":"docker-smoke-pw-123"}'
    ls "$DATADIR"
    docker inspect --format '{{.State.Health.Status}}' ct-smoke
    docker stop ct-smoke
    rm -rf "$DATADIR"
  else
    echo "docker unavailable — skipping container smoke test"
  fi
  ```
  - Expected (Docker present): `/api/health` prints `{"status":"ok"}`; the grep prints `<title>company trello</title>` (SPA served from `client/dist`); the login POST returns the admin `Me` JSON (`"isAdmin":true`) — proving migrations + bootstrap ran on the mounted `/data`; `ls "$DATADIR"` shows `app.db` (+ WAL files); the health status is `healthy` (allow one poll — re-run the inspect after another few seconds if it still says `starting`); `docker stop` prints the container name.
  - Expected (Docker absent): prints the skip message.

- [ ] **Step 4: Commit.**
  ```
  git add Dockerfile && git commit -m "chore(docker): alpine multi-stage image with native sqlite build, /data volume, healthcheck" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 12.6: Finalize README.md (overview, dev, env, Railway deploy, backup/restore)

**Files:** `README.md` (replace the Section 1 stub)

- [ ] **Step 1: Replace `README.md`** with the full production README (shown in a four-backtick block so its inner code fences are literal):

````markdown
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
````

- [ ] **Step 2: Sanity-check the README against the code.** Confirm the documented scripts and env vars actually exist:
  ```
  grep -E '"(dev|build|test|e2e)"' package.json
  grep -E 'SESSION_SECRET|ADMIN_EMAIL|APP_URL|BACKUP_S3_ENDPOINT' .env.example
  ```
  - Expected: the first prints the four root scripts; the second prints the matching env keys from `.env.example` (Section 1). No missing references.

- [ ] **Step 3: Commit.**
  ```
  git add README.md && git commit -m "docs: production README (overview, dev, env, Railway deploy, backup/restore)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Section verification (all must hold to finish the build)

- [ ] **Full E2E suite green.** `npm run e2e` → the webServer builds + starts once, then `4 passed` files / `5 passed` tests: `smoke` (2), `journey` (1), `livesync` (1), `auth` (1). Any red is a Section 8–11 UI-handle drift — reconcile it against the "UI selector contract" table (the only place selectors live are `e2e/helpers.ts` and the card-detail block in `journey.spec.ts`).
- [ ] **Unit suites still green.** `npm test` (root) → server tests then client tests all pass, exit 0 (this section adds no unit code, so nothing regresses).
- [ ] **Image builds and runs** (skip only if Docker is unavailable here; then re-run on a Docker host before deploy): `docker build -t company-trello .` succeeds; the container serves `/api/health` (`{"status":"ok"}`) and the SPA shell, an admin login against the bootstrap env succeeds, `app.db` appears on the mounted `/data`, and `HEALTHCHECK` reports `healthy`.
- [ ] **README is accurate.** Documented scripts (`dev`/`build`/`test`/`e2e`) and env vars match `package.json` and `.env.example`; Railway steps mount `/data`, set `SESSION_SECRET`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`APP_URL`, and enable volume snapshots; the backup/restore runbook matches the nightly job (`/data/backups/`, keep 14, optional S3) and the `/data/uploads/` attachment location.
- [ ] **Clean tree.** `git status` → nothing uncommitted; all six tasks committed with the `Co-Authored-By: Claude Opus 4.8` trailer.

**Definition of done for the whole project** (spec Success criteria): all server + client unit tests and the E2E suite pass; two browsers on one board converge in under a second (`livesync.spec.ts`); a brand-new teammate can be invited, join, and act (`auth.spec.ts` + `journey.spec.ts`); and the app runs from a single `docker run` with one volume mounted (Task 12.5).


---

