import { getToken } from "next-auth/jwt";
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/tokens";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    
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

}

const token = await getToken({

req: req as unknown as { headers: Record<string, string> },
      secret: process.env.AUTH_SECRET,

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
