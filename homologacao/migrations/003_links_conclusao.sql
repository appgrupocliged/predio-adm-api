-- Somente homologação: links portadores para solicitações SIM-*.
CREATE TABLE IF NOT EXISTS hml_completion_links (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash)=64),
  idempotency_key TEXT NOT NULL REFERENCES qr_requests(idempotency_key),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hml_links_request ON hml_completion_links(idempotency_key);
