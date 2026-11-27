
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM deps AS build

ENV DATABASE_URL="postgresql://postgres@localhost:5432/assign_db?schema=public"
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src

RUN npx prisma generate --generator backend


FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json /app/package-lock.json /app/prisma.config.ts ./

EXPOSE 4000


CMD ["sh", "-c", "npx prisma migrate deploy && exec node --import tsx src/index.ts"]
