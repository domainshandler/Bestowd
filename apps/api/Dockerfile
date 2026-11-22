# Bestowd API. Build from the repo root (it needs the pnpm workspace):
#   docker build -f apps/api/Dockerfile -t bestowd-api .
# On start it applies pending database migrations, then serves on $PORT (3000).
FROM node:22-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /repo

# Manifests first so the dependency install is cached between code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/api-client/package.json packages/api-client/
RUN corepack install && pnpm install --frozen-lockfile --filter "@bestowd/api..."

COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @bestowd/api exec prisma generate \
    && pnpm --filter "@bestowd/api..." build

WORKDIR /repo/apps/api
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && exec node dist/index.js"]
