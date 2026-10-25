# Build from the Identity workspace root.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN npm install -g bun@1.3.14
COPY package.json bun.lock ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/auth/package.json ./packages/auth/package.json
RUN bun install --frozen-lockfile --filter frontend
COPY frontend ./frontend
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Type-check separately in CI; runtime only needs the compiled SPA.
RUN cd frontend && bun run build-only

FROM nginx:1.28-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/hemia-labs/identity"
COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
# No startup scripts need to modify the read-only filesystem.
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
