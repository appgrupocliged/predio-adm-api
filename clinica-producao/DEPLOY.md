# Implantação da Clínica CLIGED — produção isolada

**Nunca alterar a branch `main`, Worker `predio-adm-api` ou seus 19 QR Codes.**

## Cloudflare
1. Criar D1 `cliged-qr-clinica-db`, exclusivo da Clínica. Executar `clinica-producao/schema.sql` no console DESTE D1.
2. Copiar `clinica-producao/wrangler.example.jsonc` para `clinica-producao/wrangler.jsonc`, substituindo `SUBSTITUIR_PELO_ID_REAL_DO_D1_CLINICA` pelo UUID D1 verdadeiro.
3. Criar Worker separado **`cliged-qr-clinica`**, branch `producao/clinica-macae-v1`, com deploy command `npx wrangler deploy --config clinica-producao/wrangler.jsonc`; garantir que a nova configuração não esteja ligada ao Worker do ADM. Alternativamente publicar via CI exclusivo depois da configuração.
4. Configurar os secrets **exclusivamente no novo Worker**, nunca repassar no chat:
   - `HML_TOMTICKET_TOKEN` (secret API TomTicket)
   - `HML_GOOGLE_CHAT_WEBHOOK_URL` (secret webhook operacional)
   - `HML_PILOT_CUSTOMER_ID` (cliente da integração atual)
   - `HML_PILOT_DEPARTMENT_ID`
   - `HML_PILOT_OPERATOR_ID`
5. Testar GET `https://cliged-qr-clinica.appgrupocliged.workers.dev/`; deverá exibir `status:online` e `locais:9`.
6. Habilitar apenas B.01 alterando variáveis no novo Worker:
   - `HML_CLINIC_LIVE_ENABLED=SIM_APROVADO`
   - `HML_CLINIC_LIVE_ALLOWED_LOCAL=B.01`
   - `HML_CLINIC_REAL_COMPLETION_ENABLED=SIM_APROVADO`
7. Validar o ciclo completo do B.01 na PRODUÇÃO NOVA: abertura no TomTicket, aviso no Google Chat, conclusão pela colaboradora, aviso final e status no celular.
8. Só depois do aceite, trocar `HML_CLINIC_LIVE_ALLOWED_LOCAL=TODOS_9` para liberar todos os nove códigos; imprimir em `https://cliged-qr-clinica.appgrupocliged.workers.dev/qr-codes`.

## Segurança
- Não migrar dados do banco HML para produção.
- Não habilitar `TODOS_9` sem verificação real do novo Worker.
- O link de conclusão usa bearer token único com validade de 30 dias. O encerramento possui trava idempotente; falhas externas não são repetidas automaticamente.
- O código compartilha módulos testados, mas o Worker, banco, secrets, domínio e QR Codes são novos.
- Caso haja falha ambígua, verificar o TomTicket antes de qualquer reenvio.
- Antes do GO, rotacionar tokens administrativos que tenham sido expostos.

## Retenção automática (pré-instalada, DESLIGADA)
- A migração `010_retencao_segura.sql` já integra `schema.sql` para bancos novos. Em bancos existentes, executar apenas `010_retencao_segura.sql`.
- O Worker possui cron `0 5 * * 1` (segunda-feira 05:00 UTC, 02:00 em Macaé) e só executa caso `CLINIC_RETENTION_ENABLED=SIM_90_DIAS`.
- Configurações: `CLINIC_RETENTION_DAYS=90`, `CLINIC_RETENTION_BATCH_SIZE=10` (máximo 25 registros por execução).
- Arquiva apenas registros da Clínica com estado `CONCLUIDA`, etapa de abertura `ATIVO` e conclusão notificada no Chat `CHAT_ENVIADO`, cuja última atualização ocorreu há mais de 90 dias.
- Faz agregação mensal por local e serviço antes da exclusão dos dados detalhados, em transações D1. Preserva chamados em aberto, com resultado incerto e registros recentes.
- O TomTicket é o histórico oficial: a retenção local não substitui backup externo, exportação dos dados ou necessidade de atender às políticas internas de privacidade e auditoria.
- Não habilitar até aceite técnico; acompanhar logs e armazenamento D1. Para reter detalhamento além de 90 dias, não ativar esta política.
