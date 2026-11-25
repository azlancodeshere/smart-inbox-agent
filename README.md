# Full-Stack Auth Starter

A minimal but complete authentication scaffold:

- **Frontend:** Next.js (App Router) + Tailwind CSS + **Auth.js (NextAuth v5)** — sign up / sign in with **Google**, **GitHub**, or **email + password**
- **Backend:** **TypeScript** Express + Node.js + **Prisma ORM 7** + **PostgreSQL** — a protected API that verifies the Auth.js session

```
Browser ──▶ Next.js (:3000) ──auth──▶ PostgreSQL
                │
                │  Authorization: Bearer <Auth.js session token>
                ▼
          Express API (:4000) ──Prisma──▶ PostgreSQL
```

Both apps share **one PostgreSQL database**. Auth.js stores users/accounts in it, and the Express API reads the same `User` table.

---

## Prerequisites

- **Node.js 22+**
- **A PostgreSQL database** — either local PostgreSQL or a managed service such
  as [Neon](https://neon.tech) (this repo is configured for Neon)

---

## Setup

### 1. Get a connection string

**Neon:** create a project at <https://console.neon.tech> and copy the pooled
connection string (it looks like
`postgresql://user:pass@ep-xxx-pooler.c-...neon.tech/neondb?sslmode=require`).

**Local PostgreSQL:**

```bash
createdb assign_db
# or: psql -U postgres -c "CREATE DATABASE assign_db;"
```

### 2. Configure environment

Copy the example env files and edit them:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

Set `DATABASE_URL` to your connection string in **both** `.env` files, and use
the **same** `AUTH_SECRET` in both.

The backend also signs the **access/refresh token pair** — four more vars in
`backend/.env` (placeholders are in `backend/.env.example`):

```bash
ACCESS_TOKEN_SECRET=...     # sign/verify the short-lived token
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=...    # separate secret for the long-lived token
REFRESH_TOKEN_EXPIRY=7d
```

> Generate secrets with: `openssl rand -base64 48`

The pre-filled `.env` files in this repo already point at the Neon project for
this assignment and share a dev secret, so you can skip this step for local
testing.

### 3. Install dependencies

```bash
(cd backend  && npm install)
(cd frontend && npm install)
```

### 4. Create the database tables

There is **one shared schema, owned by the backend**:
`backend/prisma/schema.prisma` — the frontend has **no** `prisma/` folder. Both
apps point to it from their `prisma.config.ts`, and migrations live beside it in
`backend/prisma/migrations/`.

`migrate deploy` just applies the existing migration — safe for a remote
database like Neon:

```bash
cd backend
npm run prisma:deploy        # = prisma migrate deploy
```

If you edit `backend/prisma/schema.prisma`, use `npm run prisma:migrate`
instead to generate a new migration.

Then generate the Prisma clients — **one command builds both apps' clients**
(Prisma 7 writes TypeScript into each app's `src/generated/prisma/`, which is
git-ignored, so this step is required after a fresh clone):

```bash
npx prisma generate          # run from backend/ or frontend/ — both work
```

### 5. Run both apps

```bash
# terminal 1 — Express API on http://localhost:4000
cd backend && npm run dev

# terminal 2 — Next.js on http://localhost:3000
cd frontend && npm run dev
```

Open **http://localhost:3000** and sign up.

> If port 3000 is already in use, Next.js automatically picks the next free
> port (e.g. 3001) and prints it. See [Notes](#notes) for what that means for OAuth.

---

## OAuth providers (Google & GitHub)

Email/password works out of the box. To enable **Sign in with Google/GitHub**,
create OAuth apps and put the credentials in `frontend/.env`.

### Google

1. Create credentials at <https://console.cloud.google.com/apis/credentials>
   (OAuth client ID → **Web application**).
2. Authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
3. Set in `frontend/.env`:
   ```
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```

### GitHub

1. Create an OAuth app at <https://github.com/settings/developers>.
2. Authorization callback URL:
   ```
   http://localhost:3000/api/auth/callback/github
   ```
3. Set in `frontend/.env`:
   ```
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   ```

> **Port matters.** If `next dev` runs on a port other than 3000, the callback
> URL becomes `http://localhost:<actual-port>/api/auth/callback/<provider>` —
> register that exact URL with the provider.

---

## How authentication works

1. **Register / sign in** (`POST /api/register`, `POST /api/login`) — the
   **Express backend** reads `req.body`, validates it, hashes the password with
   bcrypt and creates/looks up the `User` row via Prisma
   (`backend/src/routes/auth.ts`).
2. **Token pair** — on a successful login Express mints an **access token**
   (15 min, carries `id`/`email`/`name`) and a **refresh token** (7 days, id
   only) with `jwt.sign()`. Both are set as httpOnly cookies (`Path=/api`)
   *and* returned in the response body; the refresh token is also stored on
   the `User` row so it can be rotated (`backend/src/lib/tokens.ts`).
3. **Session minting** — the form then calls Auth.js's `credentials` provider,
   which verifies the same bcrypt hash (or an OAuth provider creates the user +
   `Account` row through the Prisma adapter).
4. Auth.js issues an **encrypted session token** (JWE) in the
   `authjs.session-token` cookie. Sessions use the `jwt` strategy.
5. **Calling the API** — the dashboard fetches `GET /api/session/token` to read
   the raw token, then calls the Express API with
   `Authorization: Bearer <token>`. API clients can also send the
   `accessToken` cookie or `Authorization: Bearer <accessToken>` directly.
6. **Express verifies it** — `requireAuth` in
   `backend/src/middleware/auth.ts` first tries our own access token
   (`verifyAccessToken`, `ACCESS_TOKEN_SECRET`), then falls back to Auth.js's
   `getToken()` (which decrypts the JWE using `AUTH_SECRET`) — then loads the
   user from PostgreSQL via Prisma.

### Refreshing the pair

```
POST /api/refresh   body or cookie: { refreshToken }
  → verifies the JWT, matches it against User.refreshToken (constant-time)
  → 401 if missing / invalid / already rotated
  → otherwise issues a NEW pair (rotation) and sets both cookies again

POST /api/logout    clears both cookies AND nulls User.refreshToken
```

Rotation means a stolen refresh token dies after **one** use — the copy in
the DB is replaced the moment a new pair is issued.

### Route protection

- `frontend/src/proxy.ts` (Next.js 16's replacement for `middleware.ts`)
  redirects unauthenticated visitors away from `/dashboard`, and logged-in
  users away from `/login` and `/signup`. It only checks that a cookie
  *exists* — an optimistic check, as the docs recommend.
- `frontend/src/app/dashboard/page.tsx` does the **real** `await auth()` check
  at request time (`export const instant = false` for Cache Components) and
  calls `redirect("/login")` when there's no valid session.
- The Express API independently verifies the token signature — so even a
  hand-crafted cookie can't reach protected data.

---

## Project structure

```
.
├── backend/                     TypeScript Express API — owns the DB schema
│   ├── prisma/                  ⭐ SINGLE SOURCE OF TRUTH (frontend has none)
│   │   ├── schema.prisma        ← edit this once when the data model changes
│   │   └── migrations/          ← migration history lives here
│   ├── prisma.config.ts         ← Prisma 7 config: schema → prisma/schema.prisma
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             app entry, CORS, routes, error handler
│       ├── express.d.ts         adds `req.user` to Express requests
│       ├── lib/prisma.ts        shared Prisma client (pg driver adapter)
│       ├── lib/tokens.ts        generate/verify access + refresh tokens
│       ├── middleware/auth.ts   verifies accessToken, then Auth.js token
│       ├── routes/auth.ts       /api/register, /api/login, /api/refresh, /api/logout
│       ├── routes/profile.ts    /api/ping, /api/me (protected)
│       └── generated/prisma/    ← prisma generate output (git-ignored)
│
└── frontend/                    Next.js app (no prisma/ folder)
    ├── prisma.config.ts         ← points at ../backend/prisma/schema.prisma
    └── src/
        ├── auth.ts              Auth.js config (providers, adapter, JWT callbacks)
        ├── proxy.ts             optimistic route protection (Next.js 16)
        ├── lib/prisma.ts        Prisma client (used by the Auth.js adapter)
        ├── generated/prisma/    ← prisma generate output (git-ignored)
        ├── app/
        │   ├── page.tsx         landing (links to /signup and /login)
        │   ├── signup/          sign-up page  → <AuthForm mode="signup" />
        │   ├── login/           sign-in page  → <AuthForm mode="login" />
        │   ├── dashboard/       protected page (real await auth() check)
        │   └── api/
        │       ├── auth/[...nextauth]/   Auth.js handler
        │       └── session/token/        returns the raw session JWT
        └── components/
            ├── auth-form.tsx    sign in/up form + OAuth buttons (calls Express)
            └── dashboard-client.tsx  calls the Express API
```

---

## Notes

- **One shared Prisma schema.** `backend/prisma/schema.prisma` is the single
  source of truth — it declares **two generators**, so one
  `npx prisma generate` emits a client into *both* apps. The frontend has no
  `prisma/` folder of its own. Change the data model there once, then run
  `npm run prisma:migrate` (in `backend/`) to create the migration. Nothing to
  keep in sync — there is only one copy.
- **Prisma 7.** Both apps use Prisma ORM **7.10.1** with the `prisma-client`
  generator, which emits **TypeScript into `src/generated/prisma/`** instead of
  `node_modules` — so `prisma generate` must be run once after cloning (it's in
  `.gitignore`). Two other v7 changes to know about:
  - The connection `url` lives in **`prisma.config.ts`** (each app has one),
    not in `schema.prisma` (this is what the Prisma VS Code extension's v7
    diagnostic checks for).
  - A **driver adapter** (`@prisma/adapter-pg`) is now required — both
    `src/lib/prisma.ts` files pass `new PrismaClient({ adapter })`.
  - Typecheck the API with `cd backend && npm run typecheck`.
- **Session secret.** `AUTH_SECRET` must match across both `.env` files —
  Auth.js encrypts with it and Express decrypts with it.
- **Test account.** The database starts empty — create your first account with
  the sign-up form at http://localhost:3000 (it posts to the Express API).
- **Next.js 16 specifics.** `middleware.ts` → `proxy.ts`, and the auth-gated
  `/dashboard` page sets `export const instant = false` so Cache Components
  lets it render at request time instead of prerendering (it reads the session
  with `await auth()`).
