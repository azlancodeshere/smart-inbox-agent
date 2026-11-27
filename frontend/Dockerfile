# syntax=docker/dockerfile:1

# ===========================================================================
# web — Next.js 16 (App Router, `output: "standalone"`) production image
#
#   docker build -f frontend/Dockerfile -t smart-inbox-web .   # context = REPO ROOT
#   docker compose build web                                  # same thing, via compose
#
# The Prisma schema is shared from ../backend/prisma (single source of truth),
# so the repo root — not frontend/ — has to be the build context.
#
#   build time : NEXT_PUBLIC_* is inlined into the client bundle by the
#                bundler, so it has to be correct here (ARG below).
#   runtime    : DATABASE_URL, AUTH_SECRET and the OAuth keys are read from
#                env_file in docker-compose.yml, never baked into a layer.
# ===========================================================================


# ---------- 1/3 : dependencies ---------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
# devDependencies (prisma, typescript, tailwind, eslint) are required to build
RUN --mount=type=cache,target=/root/.npm \
    npm ci


# ---------- 2/3 : build -----------------------------------------------------
FROM deps AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
# prisma.config.ts calls env("DATABASE_URL") the moment it is loaded, and
# NEXT_PUBLIC_API_URL is inlined at compile time — both are needed to build.
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    DATABASE_URL="postgresql://postgres@localhost:5432/assign_db?schema=public" \
    NEXT_TELEMETRY_DISABLED=1

# schema first: it lives outside frontend/ and changes less often than app code
COPY backend/prisma ./backend/prisma
COPY frontend ./frontend

# `--generator frontend` only emits the client we import from @/generated/prisma
# instead of also writing one into backend/src.
RUN cd frontend \
 && npx prisma generate --generator frontend \
 && npx next build


# ---------- 3/3 : runtime ---------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone/ already holds server.js, the traced node_modules and .next/server
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
# ...but static assets and public/ are not folded in automatically
COPY --from=build --chown=node:node /app/frontend/.next/static ./.next/static
COPY --from=build --chown=node:node /app/frontend/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "server.js"]
