-- HML apenas. Registra no máximo um encerramento externo do piloto já existente.
-- Não aplicar no Worker/banco do Prédio Administrativo.
CREATE TABLE IF NOT EXISTS hml_pilot_real_closure (
  request_key TEXT PRIMARY KEY NOT NULL REFERENCES hml_external_pilots(request_key),
  ticket_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'INICIADA' CHECK (state IN ('INICIADA','CONCLUIDA','INCERTA')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
