-- BANCO EXCLUSIVO DA CLINICA EM PRODUCAO. NUNCA EXECUTAR NO BANCO DO PREDIO ADM.
-- Copia apenas as estruturas necessarias, sem dados ou tokens da homologacao.

-- 001_qr_requests.sql

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


-- 002_qr_events_automaticos.sql
CREATE TRIGGER IF NOT EXISTS qr_requests_audit_insert
AFTER INSERT ON qr_requests
BEGIN
  INSERT INTO qr_events (idempotency_key, event, actor)
  VALUES (NEW.idempotency_key, 'RESERVA_CRIADA', NEW.actor);
END;

CREATE TRIGGER IF NOT EXISTS qr_requests_audit_state
AFTER UPDATE OF state ON qr_requests
WHEN OLD.state <> NEW.state
BEGIN
  INSERT INTO qr_events (idempotency_key, event, actor)
  VALUES (NEW.idempotency_key,
    'ESTADO:' || OLD.state || '->' || NEW.state, NEW.actor);
END;


-- 008_conclusao_colaboradora_real.sql
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


-- 009_clinica_live.sql
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

-- 010_retencao_segura.sql: metricas historicas e indice para arquivamento
CREATE TABLE IF NOT EXISTS clinic_monthly_summary (
  month TEXT NOT NULL CHECK(length(month)=7),
  unit_code TEXT NOT NULL,
  location_id TEXT NOT NULL,
  service TEXT NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK(completed_count >= 0),
  last_archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (month, location_id, service)
);
CREATE INDEX IF NOT EXISTS idx_qr_retention ON qr_requests(state, updated_at);
