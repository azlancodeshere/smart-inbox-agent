# Build from the REPO ROOT (context = .), e.g.
#   docker build -f frontend/Dockerfile -t smart-inbox-web .
# The Prisma schema lives in ../backend/prisma (single source of truth),
# so the root has to be part of the build context.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM deps AS build
WORKDIR /app

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it must
# be correct here. Everything else (DATABASE_URL, AUTH_SECRET, OAuth keys) is
# read at runtime and comes from env_file in docker-compose.yml.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
# prisma.config.ts calls env("DATABASE_URL") when it loads
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    DATABASE_URL="postgresql://postgres@localhost:5432/assign_db?schema=public"

# schema first: it is outside frontend/ and changes less often than app code
COPY backend/prisma ./backend/prisma
COPY frontend ./frontend

# generate writes the `frontend` generator output to src/generated/prisma
RUN cd frontend \
 && npx prisma generate \
 && npx next build \
 && cp -r public .next/standalone/ \
 && cp -r .next/static .next/standalone/.next/

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./.next/static
COPY --from=build /app/frontend/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
