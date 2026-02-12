// MODIFIED BY AI: 2026-02-12 - add manual/cron cleanup script for expired users
// FILE: server/scripts/cleanupExpiredUsers.ts

import "dotenv/config";
import { cleanupExpiredUsers, type CleanupMode } from "../cleanupExpired";
import { pool } from "../db";

async function main() {
  const rawMode = (process.argv[2] || "deactivate").toLowerCase();
  const mode: CleanupMode = rawMode === "delete" ? "delete" : "deactivate";

  const result = await cleanupExpiredUsers(mode);

  console.log(
    `[cleanup-expired] mode=${result.mode} expiredUsers=${result.expiredUsers} affectedSessions=${result.affectedSessions}`,
  );
}

main()
  .catch((error) => {
    console.error("[cleanup-expired] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
