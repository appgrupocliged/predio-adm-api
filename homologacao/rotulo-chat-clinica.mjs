// Rótulos exclusivos para as mensagens do Google Chat da Clínica Matriz.
// NÃO altera códigos, catálogo, QR Codes nem dados do TomTicket.
// Para ambientes futuros, cadastrar o tipo explicitamente; não presumir "BANHEIRO".
const ROTULOS_CLINICA = Object.freeze({
  'B.01': 'BANHEIRO COMUM 1 — RECEPÇÃO PRINCIPAL (CONSULTAS)',
  'B.02': 'BANHEIRO COMUM 2 — RECEPÇÃO PRINCIPAL (CONSULTAS)',
  'B.03': 'BANHEIRO COMUM — RECEPÇÃO 2 (EXAMES)',
  'B.04': 'BANHEIRO ACESSÍVEL (PCD) — RECEPÇÃO 2 (EXAMES)',
  'B.05': 'BANHEIRO — SALA RPA',
  'B.06': 'BANHEIRO — 2º PISO',
  'B.07': 'BANHEIRO — CONSULTÓRIO 2',
  'B.08': 'BANHEIRO — CONSULTÓRIO 4',
  'B.09': 'BANHEIRO — SALA DE EXAMES 2',
  'B.10': 'BANHEIRO — SALA ACOLHIMENTO',
  'S.01': 'SETOR — SALA CTA'
});
export function formatarLocalChatClinica(codigo) {
  return ROTULOS_CLINICA[codigo] ? codigo + ' — ' + ROTULOS_CLINICA[codigo] : String(codigo || 'não informado');
}
