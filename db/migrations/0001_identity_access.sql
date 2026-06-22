-- =====================================================================
-- One DSD vNext — Migration 0001 — Identity, Access Control, Audit base
-- Target: PostgreSQL 16+ (Azure Database for PostgreSQL Flexible Server)
-- Idempotent where practical. Applied first.
-- =====================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram search on titles
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector (used in 0002)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Roles -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text
);
INSERT INTO roles (key, label, description) VALUES
  ('staff',        'Staff',         'DSD staff; reads approved, staff-visible content.'),
  ('reviewer',     'Reviewer',      'Delegated content reviewer; no consultant authority.'),
  ('data_steward', 'Data steward',  'Manages ingestion/migration; no publish authority.'),
  ('consultant',   'Consultant',    'Owner; full authority, approvals, console.'),
  ('admin',        'Administrator', 'System administration.')
ON CONFLICT (key) DO NOTHING;

-- ---- Users -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  email         text NOT NULL UNIQUE,
  display_name  text,
  password_hash text NOT NULL,                 -- argon2id; never plaintext
  active        boolean NOT NULL DEFAULT true,
  mfa_secret    text,                           -- TOTP (consultant/admin); enrollment in Layer 6
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_assignments (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key  text NOT NULL REFERENCES roles(key),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_key)
);

-- ---- Sessions (server-side, revocable) -------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,          -- sha256 of opaque cookie token
  absolute_expiry timestamptz NOT NULL,
  idle_expiry     timestamptz NOT NULL,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS session_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  kind        text NOT NULL,                     -- login_success | login_failure | logout | revoke
  detail      text,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Invitations / password reset ------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role_key     text NOT NULL REFERENCES roles(key) DEFAULT 'staff',
  token_hash   text NOT NULL UNIQUE,             -- sha256; raw token emailed, never stored
  invited_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  used_at     timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Least-privilege application role --------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_dsd_app') THEN
    CREATE ROLE one_dsd_app NOLOGIN;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, role_assignments, sessions, session_events, invitations, password_reset_tokens
TO one_dsd_app;
GRANT SELECT ON roles, schema_migrations TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0001_identity_access') ON CONFLICT DO NOTHING;
COMMIT;
