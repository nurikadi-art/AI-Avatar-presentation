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
