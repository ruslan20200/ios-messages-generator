// MODIFIED BY AI: 2026-02-12 - add PostgreSQL connection helper for Supabase DATABASE_URL
// FILE: server/db.ts

import { Pool, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

const shouldUseSsl =
  process.env.DATABASE_SSL === "require" ||
  (process.env.DATABASE_SSL !== "disable" && process.env.NODE_ENV === "production");

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) => pool.query<T>(text, params);
