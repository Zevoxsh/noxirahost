-- NebulaHosting - Schema initial
-- Users, audit_logs, system_config

CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  username            VARCHAR(255) NOT NULL UNIQUE,
  display_name        VARCHAR(255) NOT NULL,
  email               VARCHAR(255),
  role                VARCHAR(20) NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  password_hash       TEXT,
  avatar_url          TEXT,
  stripe_customer_id  VARCHAR(255) UNIQUE,
  is_active           BOOLEAN DEFAULT TRUE,
  is_suspended        BOOLEAN DEFAULT FALSE,
  suspended_reason    TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at       TIMESTAMP
);

-- Add columns if the table already existed without them
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_unique ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   INTEGER,
  details     TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS system_config (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_config (key, value) VALUES
  ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
