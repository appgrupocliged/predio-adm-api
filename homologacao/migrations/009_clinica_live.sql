-- Banco EXCLUSIVO cliged-qr-hml-db. Aplicar após as migrações 001-008.
-- A abertura real fica DESLIGADA até o GO explícito do responsável.
CREATE TABLE IF NOT EXISTS hml_clinic_live_dispatch (
 request_key TEXT PRIMARY KEY REFERENCES qr_requests(idempotency_key),
 stage TEXT NOT NULL CHECK(stage IN (
 'CRIANDO','CRIADO','VINCULANDO','VINCULADO','LINKANDO','LINKADO',
 'CHAT_INICIADO','ATIVO','ENVIO_INCERTO','TRANSFERENCIA_INCERTA','LINK_INCERTO','CHAT_INCERTO'
 )),
 ticket_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS hml_clinic_live_rate (
 location_id TEXT PRIMARY KEY,
 last_sent_at INTEGER NOT NULL
);
