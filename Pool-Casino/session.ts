import { Request } from "express";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export function requireAuth(req: Request): number | null {
  return req.session.userId ?? null;
}
