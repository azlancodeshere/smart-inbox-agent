# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci



FROM deps AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    DATABASE_URL="postgresql://postgres@localhost:5432/assign_db?schema=public" \
    NEXT_TELEMETRY_DISABLED=1


COPY backend/prisma ./backend/prisma
COPY frontend ./frontend


RUN cd frontend \
 && npx prisma generate --generator frontend \
 && npx next build



FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0


COPY --from=build --chown=node:node /app/frontend/.next/standalone ./

COPY --from=build --chown=node:node /app/frontend/.next/static ./.next/static
COPY --from=build --chown=node:node /app/frontend/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "server.js"]
