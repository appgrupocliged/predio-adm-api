# Ativação segura do Worker isolado — CLIGED QR HML

Configuração: `homologacao/wrangler.hml.jsonc`.
Worker separado: `cliged-qr-hml-isolado`.
Entrada: `homologacao/worker-hml.mjs`.
Não possui bindings KV, credenciais TomTicket, segredos Google Chat, nem rotas operacionais ativas.

## Antes de qualquer deploy
1. Verificar execução verde no GitHub Actions (`Validacao QR multiunidade`).
2. No Cloudflare, conferir que **não existe** Worker com nome `cliged-qr-hml-isolado` que pertença a outro projeto.
3. Conferir que o token utilizado para deploy pode atuar somente no recurso de testes, nunca apagar ou substituir `predio-adm-api`.
4. Manter `wrangler.jsonc` da raiz, branch `main`, KV `PUSH_SUBS` e configurações existentes intocados.

## Deploy manual apenas com ambiente e credenciais seguros, mediante aprovação
A partir da raiz do repositório:
```bash
npx wrangler deploy --config homologacao/wrangler.hml.jsonc
```
**Não executar `npx wrangler deploy` sem `--config`**: o arquivo da raiz publica `predio-adm-api`.
A URL resultante deverá pertencer ao Worker `cliged-qr-hml-isolado` e jamais ao `predio-adm-api`.
Apenas endpoints `GET /`, `GET /catalogo`, `POST /validar` e `OPTIONS` respondem; `/solicitacao`, `/concluir`, `/status`, `/push/subscribe`, `/push/test` ficam bloqueados.

## Plano de verificação
- `GET /` informa 2 unidades, 27 locais;
- `GET /catalogo` retorna ADM-MCE (19) e CLI-MCE (8);
- `POST /validar` com `{"local_code":"B.14"}` resulta ADM-MCE:B.14;
- `POST /validar` com `{"unit_code":"CLI-MCE","local_code":"B.04"}` retorna banheiro acessível;
- `POST /solicitacao` e `POST /concluir` devem retornar 503 sem acionar TomTicket.
- Testar `predio-adm-api` somente com leitura, sem criar chamado real.

## Restrições
A conexão GitHub–Cloudflare existente pode criar builds automáticos nas branches. **Um build verde não comprova isolamento de secrets/bindings nem garante que houve deploy do Worker novo**. Não usar preview antigo para chamar operações do TomTicket.
