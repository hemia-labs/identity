# Build from the Identity workspace root.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install -g bun@1.3.14 \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/auth/package.json ./packages/auth/package.json

FROM dependencies AS builder
RUN bun install --frozen-lockfile --filter backend
COPY backend ./backend
RUN cd backend && bun run build

# A fresh install prevents development dependencies leaking into runtime.
FROM dependencies AS production-dependencies
RUN bun install --frozen-lockfile --production --filter backend \
    && mkdir -p backend/node_modules

FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/hemia-labs/identity"
ENV NODE_ENV=production PORT=4000 APP_BIND_HOST=0.0.0.0
WORKDIR /app/backend
COPY --from=production-dependencies /app/node_modules /app/node_modules
COPY --from=production-dependencies /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY backend/package.json ./package.json
USER node
EXPOSE 4000
# Migrations and seeds are explicit one-off commands, never startup hooks.
CMD ["node", "dist/src/main.js"]
