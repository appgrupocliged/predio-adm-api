-- CLIGED QR - Migração HML 001 (Cloudflare D1 / SQLite)
-- NÃO aplicar em banco de produção. Não existem bindings D1 na produção.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS qr_requests (
  idempotency_key TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  unit_code TEXT NOT NULL,
  local_code TEXT NOT NULL,
  location_id TEXT NOT NULL,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  state TEXT NOT NULL DEFAULT 'RESERVADA' CHECK (state IN (
    'RESERVADA', 'ENVIO_INICIADO', 'ABERTA', 'ENVIO_INCERTO',
    'CONCLUSAO_INICIADA', 'CONCLUIDA', 'CONCLUSAO_INCERTA'
  )),
  ticket_id TEXT UNIQUE,
  actor TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (location_id = unit_code || ':' || local_code)
);
CREATE INDEX IF NOT EXISTS idx_qr_unit_state ON qr_requests(unit_code, state);
CREATE INDEX IF NOT EXISTS idx_qr_location ON qr_requests(location_id, created_at);

CREATE TABLE IF NOT EXISTS qr_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL REFERENCES qr_requests(idempotency_key),
  event TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_qr_events_request ON qr_events(idempotency_key, id);
