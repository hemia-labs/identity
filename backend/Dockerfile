# Build stage: full toolchain (bun + dev deps), compiles app + data-source, then prunes to prod deps.
FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g bun
# ponytail: build deps for argon2's native build. Drop if your platform gets prebuilt binaries.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build && bun install --production

# Runtime stage: slim, no toolchain, no source.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
USER node
EXPOSE 4000
# Migrations run manually, not on boot.
CMD ["node", "dist/src/main.js"]
