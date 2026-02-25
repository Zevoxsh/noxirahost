-- Tickets de support

CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vm_id       INTEGER REFERENCES virtual_machines(id) ON DELETE SET NULL,
  subject     VARCHAR(255) NOT NULL,
  status      VARCHAR(20) DEFAULT 'open' CHECK(status IN ('open','in_progress','closed')),
  priority    VARCHAR(10) DEFAULT 'low' CHECK(priority IN ('low','medium','high','critical')),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_staff    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
