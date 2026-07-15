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
