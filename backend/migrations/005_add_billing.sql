-- Abonnements et factures Stripe

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vm_id                   INTEGER REFERENCES virtual_machines(id) ON DELETE SET NULL,
  plan_id                 INTEGER NOT NULL REFERENCES plans(id),
  stripe_subscription_id  VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id      VARCHAR(255) NOT NULL,
  status                  VARCHAR(30) NOT NULL
    CHECK(status IN ('active','past_due','canceled','trialing','incomplete','unpaid')),
  current_period_start    TIMESTAMP,
  current_period_end      TIMESTAMP,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vm_id ON subscriptions(vm_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS invoices (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id     INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id   VARCHAR(255) NOT NULL UNIQUE,
  amount_paid         NUMERIC(10,2),
  currency            VARCHAR(10) DEFAULT 'eur',
  status              VARCHAR(30),
  hosted_invoice_url  TEXT,
  invoice_pdf_url     TEXT,
  period_start        TIMESTAMP,
  period_end          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);

-- Idempotency pour les webhooks Stripe
CREATE TABLE IF NOT EXISTS stripe_events (
  stripe_event_id  VARCHAR(255) PRIMARY KEY,
  event_type       VARCHAR(100),
  processed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
