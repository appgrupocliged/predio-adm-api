# Implantação da Clínica CLIGED — produção isolada

**Nunca alterar a branch `main`, Worker `predio-adm-api` ou seus 19 QR Codes.**

## Cloudflare
1. Criar D1 `cliged-qr-clinica-db`, exclusivo da Clínica. Executar `clinica-producao/schema.sql` no console DESTE D1.
2. Copiar `clinica-producao/wrangler.example.jsonc` para `clinica-producao/wrangler.jsonc`, substituindo `SUBSTITUIR_PELO_ID_REAL_DO_D1_CLINICA` pelo UUID D1 verdadeiro.
3. Criar Worker separado **`cliged-qr-clinica`**, branch `homologacao/multiunidade-v1` até criação da branch de produção dedicada, com deploy command `npx wrangler deploy --config clinica-producao/wrangler.jsonc`; garantir que a nova configuração não esteja ligada ao Worker do ADM. Alternativamente publicar via CI exclusivo depois da configuração.
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
