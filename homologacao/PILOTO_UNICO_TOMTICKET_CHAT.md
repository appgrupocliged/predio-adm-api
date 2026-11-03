# Piloto externo único — Clínica CLIGED (HML)

**Estado inicial: DESATIVADO.** Este documento é um checklist técnico, não autoriza disparos automáticos. O usuário autorizou preparar um único chamado real de TESTE nos serviços atuais, mantendo a produção intacta.

## Isolamento
- Worker exclusivo: `cliged-qr-hml-isolado`.
- Branch: `homologacao/multiunidade-v1`.
- D1 exclusivo: `cliged-qr-hml-db`.
- **NÃO** alterar `main`, `worker.js`, `wrangler.jsonc` de produção ou os 19 QR Codes instalados.
- Não inserir tokens ou webhooks no GitHub, nem enviá-los em mensagens.

## Portões antes de habilitar
1. Confirmar aprovação da execução para **um** chamado identificado com prefixo `[TESTE HML CLIGED]`. Nunca abrir novo chamado de atendimento real a partir do fluxo simulado.
2. Aplicar **somente ao D1 HML** `homologacao/migrations/006_hml_external_pilot.sql`. A restrição `UNIQUE (pilot_slot)` impede segunda reserva global, mesmo com outra chave. Conferir antes se a tabela ainda não existe; se existir sem coluna `pilot_slot`, parar e preparar migração corretiva, sem recriar banco.
3. Selecionar um pedido sintético existente da Clínica, com `unit_code=CLI-MCE` e `ticket_id=SIM-<idempotency_key>`; não executar para a unidade ADM.
4. Configurar **somente nas variáveis/secrets do Worker de homologação**:
   - `HML_TOMTICKET_TOKEN`: Secret do TomTicket autorizado a criar chamado de TESTE no serviço atual.
   - `HML_GOOGLE_CHAT_WEBHOOK_URL`: Secret do webhook autorizado da sala atual.
   - `HML_PILOT_DEPARTMENT_ID`: identificador do departamento previamente confirmado.
   - `HML_PILOT_OPERATOR_ID`: identificador de Gleice previamente confirmado.
   - `HML_PILOT_CUSTOMER_ID`: cliente autorizado para o ticket de teste.
   - `HML_PILOT_REQUEST_KEY`: **a chave UUID exata** da solicitação HML escolhida.
   - `HML_EXTERNAL_PILOT_ENABLED`: manter ausente até a execução única autorizada.
5. Conferir que o Worker HML fez deploy da versão nova e que seus testes passaram. Confirmar no D1 que `hml_external_pilots` está vazia; se não estiver, **não repetir**.
6. Apenas quando for executar o ensaio único, configurar `HML_EXTERNAL_PILOT_ENABLED=SIM_UM_CHAMADO`, fazer uma única chamada autenticada `POST /hml/integracao/piloto` com `{"idempotency_key":"<uuid autorizado>","confirmacao":"CONFIRMO UM CHAMADO REAL DE TESTE"}`.
7. Em seguida remover `HML_EXTERNAL_PILOT_ENABLED`. Verificar manualmente ticket e mensagem no sistema externo; **não repetir o POST** em caso de timeout ou erro, pois o resultado pode ter sido parcialmente executado.

## Escopo e limitações
- Cria **somente um ticket real de TESTE**, tenta vincular ao operador e enviar **uma** notificação no Google Chat.
- Não insere link real de conclusão e não fecha ticket real. A conclusão HML existente permanece sintética.
- Reenvio ou falhas ambíguas **não** executam novas chamadas automáticas. Reconciliar manualmente com ticket e ledger antes de alterar código.
- `HML_EXTERNAL_PILOT_ENABLED` está ausente do Wrangler do projeto. Sem ela e sem secrets isolados, a rota responde com bloqueio.
- Mensagens no Google Chat e assunto do chamado indicam claramente **TESTE**, para não confundirem a equipe operacional.
- Verificação da criação real e dos resultados externos só é possível após execução expressa do teste único.
