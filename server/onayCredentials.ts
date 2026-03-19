// MODIFIED BY AI: 2026-03-19 - store optional admin-managed Onay account override encrypted in database
// FILE: server/onayCredentials.ts

import crypto from "crypto";
import { query } from "./db";
import { loadOnayConfig, type OnayConfig } from "./onayClient";

type OnayCredentialsRow = {
  phone_number_encrypted: string;
  password_encrypted: string;
  updated_at: string;
  updated_by_login: string | null;
};

export type OnayAccountSummary = {
  source: "env" | "admin";
  phoneNumberMasked: string;
  updatedAt: string | null;
  updatedByLogin: string | null;
};

const maskPhoneNumber = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "-";
  if (trimmed.length <= 6) return trimmed;
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-2)}`;
};

const getEncryptionKey = () => {
  const secret = process.env.ONAY_CREDENTIALS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing ONAY_CREDENTIALS_SECRET or JWT_SECRET for Onay credential encryption");
  }

  return crypto.createHash("sha256").update(secret).digest();
};

const encryptValue = (value: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

const decryptValue = (payload: string) => {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

const getStoredCredentialsRow = async () => {
  const result = await query<OnayCredentialsRow>(
    `SELECT
       c.phone_number_encrypted,
       c.password_encrypted,
       c.updated_at,
       u.login AS updated_by_login
     FROM onay_credentials c
     LEFT JOIN users u ON u.id = c.updated_by_admin_id
     WHERE c.id = 1`,
  );

  return result.rows[0] || null;
};

export const getOnayAccountSummary = async (): Promise<OnayAccountSummary> => {
  const stored = await getStoredCredentialsRow();

  if (!stored) {
    return {
      source: "env",
      phoneNumberMasked: maskPhoneNumber(process.env.ONAY_PHONE_NUMBER || ""),
      updatedAt: null,
      updatedByLogin: null,
    };
  }

  try {
    return {
      source: "admin",
      phoneNumberMasked: maskPhoneNumber(decryptValue(stored.phone_number_encrypted)),
      updatedAt: stored.updated_at,
      updatedByLogin: stored.updated_by_login,
    };
  } catch (error) {
    console.warn("Failed to decrypt stored Onay credentials, falling back to env", error);
    return {
      source: "env",
      phoneNumberMasked: maskPhoneNumber(process.env.ONAY_PHONE_NUMBER || ""),
      updatedAt: null,
      updatedByLogin: null,
    };
  }
};

export const getEffectiveOnayConfig = async (): Promise<OnayConfig> => {
  const stored = await getStoredCredentialsRow();

  if (!stored) {
    return loadOnayConfig();
  }

  try {
    return loadOnayConfig({
      phoneNumber: decryptValue(stored.phone_number_encrypted),
      password: decryptValue(stored.password_encrypted),
    });
  } catch (error) {
    console.warn("Stored Onay credentials are invalid, using env fallback", error);
    return loadOnayConfig();
  }
};

export const saveOnayAccountOverride = async (params: {
  phoneNumber: string;
  password: string;
  adminUserId: number | null;
}) => {
  await query(
    `INSERT INTO onay_credentials (
       id,
       phone_number_encrypted,
       password_encrypted,
       updated_by_admin_id,
       created_at,
       updated_at
     )
     VALUES (1, $1, $2, $3, NOW(), NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       phone_number_encrypted = EXCLUDED.phone_number_encrypted,
       password_encrypted = EXCLUDED.password_encrypted,
       updated_by_admin_id = EXCLUDED.updated_by_admin_id,
       updated_at = NOW()`,
    [encryptValue(params.phoneNumber), encryptValue(params.password), params.adminUserId],
  );
};

export const clearOnayAccountOverride = async () => {
  await query(`DELETE FROM onay_credentials WHERE id = 1`);
};
