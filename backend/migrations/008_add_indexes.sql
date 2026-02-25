-- Index de performance additionnels

CREATE INDEX IF NOT EXISTS idx_isos_node_id ON isos(node_id);
CREATE INDEX IF NOT EXISTS idx_lxc_templates_node_id ON lxc_templates(node_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events(processed_at);
