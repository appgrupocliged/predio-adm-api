-- SOMENTE homologação: cliged-qr-hml-db, jamais banco/Worker de produção.
-- Não aplicar automaticamente via deploy: revisão e aplicação HML manual.
-- IMPORTANTE: se a tabela 006 já tiver sido aplicada, NÃO repetir CREATE TABLE
-- para adicionar esta coluna; será necessária uma migração corretiva específica.
CREATE TABLE IF NOT EXISTS hml_external_pilots (
  request_key TEXT PRIMARY KEY NOT NULL REFERENCES qr_requests(idempotency_key),
  -- Bloqueio global: apenas UMA reserva em toda a homologação, mesmo para chaves diferentes.
  pilot_slot TEXT NOT NULL DEFAULT 'UNICO' UNIQUE CHECK (pilot_slot = 'UNICO'),
  status TEXT NOT NULL DEFAULT 'RESERVADO' CHECK(status IN (
    'RESERVADO','CRIANDO','CRIADO','VINCULANDO','VINCULADO',
    'NOTIFICANDO','NOTIFICADO','CRIACAO_INCERTA','VINCULO_INCERTO','CHAT_INCERTO'
  )),
  ticket_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hml_external_pilots_status ON hml_external_pilots(status);
