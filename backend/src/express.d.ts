// Adds `req.user` to Express requests (populated by the requireAuth middleware).
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string | null;
        name?: string | null;
      };
    }
  }
}

export {};
