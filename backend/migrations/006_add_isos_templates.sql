-- ISOs et templates LXC disponibles

CREATE TABLE IF NOT EXISTS isos (
  id          SERIAL PRIMARY KEY,
  node_id     INTEGER NOT NULL REFERENCES proxmox_nodes(id) ON DELETE CASCADE,
  storage     VARCHAR(100) NOT NULL,
  volid       VARCHAR(255) NOT NULL UNIQUE,
  filename    VARCHAR(255) NOT NULL,
  size_bytes  BIGINT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lxc_templates (
  id          SERIAL PRIMARY KEY,
  node_id     INTEGER NOT NULL REFERENCES proxmox_nodes(id) ON DELETE CASCADE,
  storage     VARCHAR(100) NOT NULL,
  volid       VARCHAR(255) NOT NULL UNIQUE,
  filename    VARCHAR(255) NOT NULL,
  os_type     VARCHAR(50),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
