// MODIFIED BY AI: 2026-02-12 - add cleanup helper for expired accounts
// FILE: server/cleanupExpired.ts

import { query } from "./db";

export type CleanupMode = "deactivate" | "delete";

export type CleanupResult = {
  mode: CleanupMode;
  expiredUsers: number;
  affectedSessions: number;
};

export const cleanupExpiredUsers = async (
  mode: CleanupMode = "deactivate",
): Promise<CleanupResult> => {
  if (mode === "delete") {
    const deleted = await query<{ id: number }>(
      `DELETE FROM users
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING id`,
    );

    return {
      mode,
      expiredUsers: deleted.rowCount ?? 0,
      affectedSessions: deleted.rowCount ?? 0,
    };
  }

  const affectedSessions = await query(
    `UPDATE sessions
     SET is_active = FALSE,
         last_seen = NOW()
     WHERE user_id IN (
       SELECT id FROM users
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
     ) AND is_active = TRUE`,
  );

  const expiredUsers = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM users
     WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
  );

  return {
    mode,
    expiredUsers: Number(expiredUsers.rows[0]?.count || "0"),
    affectedSessions: affectedSessions.rowCount ?? 0,
  };
};

