# Build stage: compile the SPA. VITE_API_BASE_URL is baked in at build time.
FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g bun
COPY package.json ./
RUN bun install
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# ponytail: build-only skips vue-tsc; keep type-check in CI, not in the image build.
RUN bun run build-only

# Runtime: nginx serves static assets and reverse-proxies the API (same origin).
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
