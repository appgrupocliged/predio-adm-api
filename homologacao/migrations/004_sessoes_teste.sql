-- Exclusivo de homologação: acesso temporário e limitado ao formulário de teste.
CREATE TABLE IF NOT EXISTS hml_test_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash)=64),
  expires_at INTEGER NOT NULL,
  max_requests INTEGER NOT NULL CHECK(max_requests BETWEEN 1 AND 20),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hml_test_requests (
  idempotency_key TEXT PRIMARY KEY NOT NULL,
  session_hash TEXT NOT NULL REFERENCES hml_test_sessions(token_hash),
  fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hml_test_requests_session ON hml_test_requests(session_hash);
