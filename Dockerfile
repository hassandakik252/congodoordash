# API server image. Builds the esbuild bundle and runs it.
FROM node:20-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy the repo (node_modules/dist excluded via .dockerignore) and install only
# the api-server subtree (+ its workspace deps: db, api-zod).
COPY . .
RUN pnpm install --frozen-lockfile --filter @workspace/api-server...

# Bundle the server (dist/index.mjs + pino workers).
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production \
    PORT=8080 \
    UPLOAD_DIR=/app/uploads
EXPOSE 8080

# DATABASE_URL, JWT_SECRET, PUBLIC_URL, etc. are provided at runtime.
CMD ["node", "artifacts/api-server/dist/index.mjs"]
