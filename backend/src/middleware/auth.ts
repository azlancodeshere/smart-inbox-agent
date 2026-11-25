import { getToken } from "next-auth/jwt";
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/tokens";

/**
 * Verifies credentials for protected routes, trying TWO token types:
 *
 *   ① our own short-lived accessToken — the `accessToken` cookie set by
 *      POST /api/login (or `Authorization: Bearer <accessToken>`), which
 *      carries { id, email, name } signed with ACCESS_TOKEN_SECRET.
 *   ② the Auth.js session token (JWE) — what the Next.js dashboard sends
 *      via GET /api/session/token. Auth.js v5 encrypts it (A256CBC-HS512)
 *      derived from AUTH_SECRET, so we use Auth.js's own `getToken` helper.
 *
 * Either way `req.user` is populated and `next()` runs; no valid token → 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // ① Access token: cookie first, then the Authorization header.
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    const ownToken = req.cookies?.accessToken || bearer;
    if (ownToken) {
      const payload = verifyAccessToken(ownToken);
      if (payload) {
        req.user = {
          id: payload.id,
          email: payload.email ?? null,
          name: payload.name ?? null,
        };
        return next();
      }
      // Invalid/expired access token → fall through to ② (the dashboard's
      // Auth.js Bearer still works, so a stale cookie isn't fatal).
    }

    // ② Auth.js session token (JWE).
    const token = await getToken({
      // getToken only needs `headers`; Express's IncomingHttpHeaders is
      // structurally compatible at runtime (it widens values to string[] too).
      req: req as unknown as { headers: Record<string, string> },
      secret: process.env.AUTH_SECRET,
      // Must match the flag Auth.js used when encrypting the token:
      // http in dev, https in production.
      secureCookie: (process.env.CLIENT_ORIGIN ?? "").startsWith("https"),
    });

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.user = {
      id: (token.sub ?? token.id) as string,
      email: token.email ?? null,
      name: token.name ?? null,
    };
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
