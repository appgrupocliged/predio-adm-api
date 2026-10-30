-- Somente homologação: limita um acesso de QR a uma unidade/local no servidor.
CREATE TABLE IF NOT EXISTS hml_test_qr_locations (
  session_hash TEXT PRIMARY KEY NOT NULL REFERENCES hml_test_sessions(token_hash),
  unit_code TEXT NOT NULL,
  local_code TEXT NOT NULL
);
