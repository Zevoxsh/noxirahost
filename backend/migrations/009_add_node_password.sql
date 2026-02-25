-- Support authentification par mot de passe en plus des API tokens
ALTER TABLE proxmox_nodes ADD COLUMN IF NOT EXISTS pve_password TEXT;
