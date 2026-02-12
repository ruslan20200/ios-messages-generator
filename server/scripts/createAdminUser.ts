// MODIFIED BY AI: 2026-02-12 - add helper script to seed first admin user in database
// FILE: server/scripts/createAdminUser.ts

import "dotenv/config";
import { hashPassword } from "../auth";
import { pool, query } from "../db";

async function main() {
  const login = String(process.argv[2] || "").trim().toLowerCase();
  const password = String(process.argv[3] || "");

  if (!login || !password) {
    throw new Error("Usage: pnpm tsx server/scripts/createAdminUser.ts <login> <password>");
  }

  const passwordHash = await hashPassword(password);

  const result = await query<{ id: number; login: string }>(
    `INSERT INTO users (login, password_hash, role, device_id, expires_at)
     VALUES ($1, $2, 'admin', NULL, NULL)
     ON CONFLICT (login) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'admin'
     RETURNING id, login`,
    [login, passwordHash],
  );

  console.log(`[seed-admin] admin ready: id=${result.rows[0]?.id} login=${result.rows[0]?.login}`);
}

main()
  .catch((error) => {
    console.error("[seed-admin] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });