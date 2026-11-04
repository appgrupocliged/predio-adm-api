-- Política de retenção CLIGED: resumos históricos por mês, local e serviço.
-- Nunca arquivar chamados abertos, incertos ou sem Chat confirmado.
-- O histórico de atendimento completo permanece no TomTicket.
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
