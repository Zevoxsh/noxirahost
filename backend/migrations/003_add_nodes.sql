-- Noeuds Proxmox VE

CREATE TABLE IF NOT EXISTS proxmox_nodes (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  host            VARCHAR(255) NOT NULL,
  port            INTEGER DEFAULT 8006,
  pve_user        VARCHAR(255) NOT NULL DEFAULT 'root@pam',
  pve_token_id    VARCHAR(255),
  pve_token_secret TEXT,
  use_ssl         BOOLEAN DEFAULT TRUE,
  verify_ssl      BOOLEAN DEFAULT FALSE,
  storage         VARCHAR(100) DEFAULT 'local',
  bridge          VARCHAR(50) DEFAULT 'vmbr0',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
