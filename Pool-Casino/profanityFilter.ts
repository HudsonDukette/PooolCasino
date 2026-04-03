import type { Request, Response, NextFunction } from "express";
import { checkProfanity } from "../lib/profanity";
import { db, reportsTable } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Express middleware that scans req.body.content for profanity.
 *
 * Severity rules:
 *   high   → block the request (403)
 *   medium → allow but auto-file a moderation report
 *   low    → allow silently (no report)
 *
 * Attach `profanityResult` to `req` so route handlers can inspect it.
 */
export async function profanityFilter(
  req: Request & { profanityResult?: ReturnType<typeof checkProfanity>; reportedUserId?: number },
  res: Response,
  next: NextFunction
): Promise<void> {
  const text: string = (req.body?.content ?? "").trim();

  if (!text) {
    next();
    return;
  }

  const result = checkProfanity(text);
  req.profanityResult = result;

  if (result.clean || result.severity === "low") {
    next();
    return;
  }

  const userId: number | undefined = (req as any).session?.userId;

  if (result.severity === "high") {
    logger.warn(
      { userId, matched: result.matched, text },
      "Profanity filter blocked message (high severity)"
    );

    // Log to moderation system asynchronously (don't block the response)
    if (userId != null) {
      db.insert(reportsTable)
        .values({
          reporterId: null,           // system-generated
          reportedUserId: userId,
          reason: "Auto: profanity (high)",
          details: `Blocked message. Matched: [${result.matched.join(", ")}]. Original: "${text.slice(0, 300)}"`,
          status: "pending",
        })
        .catch((err) =>
          logger.error({ err }, "Failed to log profanity report (high)")
        );
    }

    res.status(403).json({
      error: "profanity",
      message: "Your message contains language that is not allowed.",
    });
    return;
  }

  // medium — allow through, file a background report
  if (result.severity === "medium" && userId != null) {
    db.insert(reportsTable)
      .values({
        reporterId: null,
        reportedUserId: userId,
        reason: "Auto: profanity (medium)",
        details: `Message allowed but flagged. Matched: [${result.matched.join(", ")}]. Original: "${text.slice(0, 300)}"`,
        status: "pending",
      })
      .catch((err) =>
        logger.error({ err }, "Failed to log profanity report (medium)")
      );

    logger.info(
      { userId, matched: result.matched },
      "Profanity filter flagged message (medium severity)"
    );
  }

  next();
}
