FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/sync/package.json ./apps/sync/
RUN pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY apps/sync/ ./apps/sync/
RUN pnpm --filter @whiteboard/shared run db:generate
RUN pnpm --filter @whiteboard/shared run build
RUN pnpm --filter @whiteboard/sync run build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 1234
CMD ["pnpm", "--filter", "@whiteboard/sync", "start"]
