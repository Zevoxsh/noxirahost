-- Ensure invoices.updated_at exists for upsert updates

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
