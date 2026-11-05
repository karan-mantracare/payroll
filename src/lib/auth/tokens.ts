import { createHash } from "crypto";
import { db } from "../db/client";
import { usedTokens } from "../db/schema";
import { eq, lt } from "drizzle-orm";

const TOKEN_EXPIRY_MS = (parseInt(process.env.TOKEN_EXPIRY_SECONDS || "300", 10)) * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Checks if a token has already been redeemed (replay attack prevention).
 */
export async function isTokenUsed(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const existing = await db
    .select()
    .from(usedTokens)
    .where(eq(usedTokens.tokenHash, tokenHash))
    .limit(1);

  return existing.length > 0;
}

/**
 * Marks a token as redeemed so it cannot be re-used.
 * Returns true if successfully redeemed, false if already redeemed or simultaneous race condition detected.
 */
export async function markTokenAsUsed(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + TOKEN_EXPIRY_MS;

  try {
    await db.insert(usedTokens).values({
      tokenHash,
      usedAt: now,
      expiresAt,
    });

    // Opportunistic cleanup of expired token records
    try {
      await db.delete(usedTokens).where(lt(usedTokens.expiresAt, now - 86400000));
    } catch {
      // Non-fatal background cleanup
    }

    return true;
  } catch (err: any) {
    // Unique constraint violation on tokenHash primary key indicates simultaneous redemption
    return false;
  }
}

