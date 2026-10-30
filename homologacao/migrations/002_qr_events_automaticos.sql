-- Exclusivo para cliged-qr-hml-db. Não aplicar em produção.
-- O evento participa da mesma transação da reserva ou mudança de estado:
-- uma falha no evento desfaz também a alteração do registro.
-- Não reconstrói eventos de registros anteriores à instalação.
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
