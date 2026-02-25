-- Plans d'hébergement (Starter/Pro/Enterprise × KVM/LXC)

CREATE TABLE IF NOT EXISTS plans (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  slug             VARCHAR(50) NOT NULL UNIQUE,
  vm_type          VARCHAR(10) NOT NULL CHECK(vm_type IN ('kvm', 'lxc')),
  tier             VARCHAR(5) NOT NULL CHECK(tier IN ('s', 'm', 'l')),
  cpu_cores        INTEGER NOT NULL,
  ram_mb           INTEGER NOT NULL,
  disk_gb          INTEGER NOT NULL,
  bandwidth_gb     INTEGER,
  price_monthly    NUMERIC(10,2) NOT NULL,
  stripe_price_id  VARCHAR(255) NOT NULL DEFAULT 'price_PLACEHOLDER',
  max_snapshots    INTEGER DEFAULT 3,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plans KVM
INSERT INTO plans (name, slug, vm_type, tier, cpu_cores, ram_mb, disk_gb, price_monthly, stripe_price_id) VALUES
  ('Starter KVM',      'starter-kvm',      'kvm', 's', 1, 1024,  20,  4.99, 'price_starter_kvm_PLACEHOLDER'),
  ('Pro KVM',          'pro-kvm',          'kvm', 'm', 2, 4096,  60, 14.99, 'price_pro_kvm_PLACEHOLDER'),
  ('Enterprise KVM',   'enterprise-kvm',   'kvm', 'l', 4, 8192, 120, 29.99, 'price_enterprise_kvm_PLACEHOLDER')
ON CONFLICT (slug) DO NOTHING;

-- Plans LXC
INSERT INTO plans (name, slug, vm_type, tier, cpu_cores, ram_mb, disk_gb, price_monthly, stripe_price_id) VALUES
  ('Starter LXC',      'starter-lxc',      'lxc', 's', 1,  512,  10,  2.99, 'price_starter_lxc_PLACEHOLDER'),
  ('Pro LXC',          'pro-lxc',          'lxc', 'm', 2, 2048,  30,  7.99, 'price_pro_lxc_PLACEHOLDER'),
  ('Enterprise LXC',   'enterprise-lxc',   'lxc', 'l', 4, 4096,  80, 17.99, 'price_enterprise_lxc_PLACEHOLDER')
ON CONFLICT (slug) DO NOTHING;
