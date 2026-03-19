-- MODIFIED BY AI: 2026-03-19 - persist admin-managed Onay account override outside Render env
-- FILE: migrations/002_create_onay_credentials.sql

CREATE TABLE IF NOT EXISTS onay_credentials (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phone_number_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  updated_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
