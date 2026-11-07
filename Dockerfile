# syntax=docker/dockerfile:1

# ---- build: install, build the SPA, then prune to production deps ----
FROM node:24-slim AS build
# Toolchain only as a fallback for better-sqlite3 when no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: production node_modules + built SPA + server source (Node 24 runs .ts directly) ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/workout.db \
    OVERRIDES_DIR=/data/media-overrides
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY src/core ./src/core
COPY src/data ./src/data
COPY src/server ./src/server
RUN mkdir -p /data/media-overrides && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "fetch('http://localhost:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server/main.ts"]
