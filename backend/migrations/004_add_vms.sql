-- Machines virtuelles et conteneurs

CREATE TABLE IF NOT EXISTS virtual_machines (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id       INTEGER NOT NULL REFERENCES proxmox_nodes(id),
  plan_id       INTEGER NOT NULL REFERENCES plans(id),
  vmid          INTEGER NOT NULL,
  vm_type       VARCHAR(10) NOT NULL CHECK(vm_type IN ('kvm', 'lxc')),
  name          VARCHAR(100) NOT NULL,
  hostname      VARCHAR(255),
  status        VARCHAR(20) DEFAULT 'provisioning'
                  CHECK(status IN ('running','stopped','suspended','error','provisioning','deleting')),
  os_template   VARCHAR(255),
  ip_address    VARCHAR(45),
  ipv6_address  VARCHAR(45),
  cpu_cores     INTEGER NOT NULL,
  ram_mb        INTEGER NOT NULL,
  disk_gb       INTEGER NOT NULL,
  is_suspended  BOOLEAN DEFAULT FALSE,
  deleted_at    TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(node_id, vmid)
);

CREATE INDEX IF NOT EXISTS idx_vms_user_id  ON virtual_machines(user_id);
CREATE INDEX IF NOT EXISTS idx_vms_node_id  ON virtual_machines(node_id);
CREATE INDEX IF NOT EXISTS idx_vms_status   ON virtual_machines(status);
CREATE INDEX IF NOT EXISTS idx_vms_deleted  ON virtual_machines(deleted_at);
