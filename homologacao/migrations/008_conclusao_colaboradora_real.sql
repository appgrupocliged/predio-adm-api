-- Fluxo real da colaboradora: somente o banco cliged-qr-hml-db.
-- Não aplicar na produção; desligado por padrão no Worker HML.
CREATE TABLE IF NOT EXISTS hml_real_completion_links (
 token_hash TEXT PRIMARY KEY,
 request_key TEXT NOT NULL UNIQUE REFERENCES qr_requests(idempotency_key),
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hml_real_completion_dispatch (
 request_key TEXT PRIMARY KEY REFERENCES qr_requests(idempotency_key),
 ticket_id TEXT NOT NULL UNIQUE,
 actor TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN (
  'TOMTICKET_INICIADO','TOMTICKET_CONCLUIDO','TOMTICKET_INCERTO',
  'CHAT_INICIADO','CHAT_ENVIADO','CHAT_INCERTO'
 )),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
