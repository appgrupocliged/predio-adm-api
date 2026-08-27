const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://appgrupocliged.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=UTF-8"
};


// ============================================================
// MAPA OFICIAL DOS QR CODES
// ============================================================

const LOCAIS_QR = {

    "B.01": "DIRETORIA",
    "B.02": "CORREDOR AUTORIZAÇÃO",
    "B.03": "FINANCEIRO",
    "B.04": "RH",
    "B.05": "COMPRAS",
    "B.06": "ESTOQUE",
    "B.07": "ESTOQUE",
    "B.08": "CONTROLADORIA",
    "B.09": "COWORKING",
    "B.10": "CORREDOR REUNIÃO",
    "B.11": "D.P",
    "B.12": "CORREDOR CALL CENTER",
    "B.13": "COMFORT ADM",
    "B.14": "T.I",
    "B.15": "CTA ADM",
    "B.16": "MARKETING / INFRAESTRUTURA",
    "B.17": "FATURAMENTO",
    "B.18": "AUDITORIA",
    "B.19": "QUALIDADE"

};


// ============================================================
// CONFIGURAÇÕES FIXAS
// ============================================================

const DEPARTMENT_ID =
    "2d507dafee35b29d9e5852d9b0c4ce2c";

const CATEGORY_ID =
    "52d32a3af1d7fd87c277f7aec520b38b";


// ============================================================
// URL DO CONCLUIR.HTML
// ============================================================

const CONCLUIR_URL =
    "https://appgrupocliged.github.io/predio-adm-api/concluir.html";


// ============================================================
// CLIENTE TOMTICKET
// ============================================================

const CUSTOMER_ID =
    "appgrupocliged@gmail.com";

const CUSTOMER_ID_TYPE =
    "E";


// ============================================================
// RESPOSTA JSON
// ============================================================

function respostaJSON(
    dados,
    status = 200
) {

    return new Response(

        JSON.stringify(
            dados,
            null,
            2
        ),

        {
            status,
            headers:
                CORS_HEADERS
        }

    );

}


// ============================================================
// WORKER
// ============================================================

export default {

    async fetch(
        request,
        env
    ) {

        // ====================================================
        // CORS
        // ====================================================

        if(
            request.method === "OPTIONS"
        ){

            return new Response(
                null,
                {
                    status: 204,
                    headers:
                        CORS_HEADERS
                }
            );

        }


        const url =
            new URL(
                request.url
            );


        // ====================================================
        // TESTE DA API
        // ====================================================

        if(
            request.method === "GET" &&
            url.pathname === "/"
        ){

            return respostaJSON({

                status:
                    "online",

                mensagem:
                    "API do sistema de solicitações funcionando",

                locais_qr:
                    Object.keys(
                        LOCAIS_QR
                    ).length

            });

        }


        // ====================================================
        // CRIAÇÃO DO CHAMADO
        // ====================================================

        if(
            request.method === "POST" &&
            url.pathname === "/solicitacao"
        ){

            try {


                // =================================================
                // RECEBE JSON
                // =================================================

                const body =
                    await request.json();


                const {
                    local_code,
                    category_id,
                    subject,
                    message,
                    priority
                } = body;


                console.log(
                    "Payload recebido:",
                    JSON.stringify(body)
                );


                // =================================================
                // VALIDA CÓDIGO
                // =================================================

                if(
                    !local_code
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "Código do local não informado."
                        },

                        400

                    );

                }


                // =================================================
                // NORMALIZA CÓDIGO
                // =================================================

                const codigo =
                    String(
                        local_code
                    )
                    .toUpperCase()
                    .trim();


                // =================================================
                // LOCAL OFICIAL
                // =================================================

                const local =
                    LOCAIS_QR[
                        codigo
                    ];


                if(
                    !local
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "Código de local inválido.",

                            codigo_recebido:
                                codigo
                        },

                        400

                    );

                }


                console.log(
                    "QR recebido:",
                    codigo
                );

                console.log(
                    "Local oficial:",
                    local
                );


                // =================================================
                // VALIDA DADOS
                // =================================================

                if(
                    !category_id ||
                    !message
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "Dados obrigatórios não informados.",

                            diagnostico: {

                                local_code:
                                    codigo,

                                category_id_recebido:
                                    !!category_id,

                                message_recebido:
                                    !!message
                            }
                        },

                        400

                    );

                }


                // =================================================
                // TOKEN
                // =================================================

                if(
                    !env.TOMTICKET_TOKEN
                ){

                    console.error(
                        "TOMTICKET_TOKEN não configurado."
                    );

                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "Token do TomTicket não configurado na API."
                        },

                        500

                    );

                }


                // =================================================
                // ASSUNTO OFICIAL
                // =================================================

                const assuntoOficial =
                    "Solicitação - " +
                    local;


                // =================================================
                // MENSAGEM OFICIAL
                // =================================================

                let mensagemRecebida =
                    String(
                        message
                    );


                mensagemRecebida =
                    mensagemRecebida.replace(
                        /\\n/g,
                        "\n"
                    );


                mensagemRecebida =
                    mensagemRecebida.replace(
                        /^Local:.*\n*/i,
                        ""
                    );


                const mensagemOficial =
                    "Local: " +
                    local +
                    "\n\n" +
                    mensagemRecebida;


                // =================================================
                // DADOS TOMTICKET
                // =================================================

                const dados =
                    new URLSearchParams();


                dados.append(
                    "customer_id",
                    CUSTOMER_ID
                );


                dados.append(
                    "customer_id_type",
                    CUSTOMER_ID_TYPE
                );


                dados.append(
                    "department_id",
                    DEPARTMENT_ID
                );


                dados.append(
                    "category_id",
                    String(
                        category_id
                    )
                );


                dados.append(
                    "subject",
                    assuntoOficial
                );


                dados.append(
                    "message",
                    mensagemOficial
                );


                dados.append(
                    "priority",
                    String(
                        priority || "2"
                    )
                );


                console.log(
                    "Criando chamado:"
                );

                console.log(
                    "Código:",
                    codigo
                );

                console.log(
                    "Local:",
                    local
                );

                console.log(
                    "Assunto:",
                    assuntoOficial
                );


                // =================================================
                // 1. CRIA O CHAMADO
                // =================================================

                const respostaCriacao =
                    await fetch(

                        "https://api.tomticket.com/v2.0/ticket/new",

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "Authorization":
                                    `Bearer ${env.TOMTICKET_TOKEN}`

                            },

                            body:
                                dados.toString()

                        }

                    );


                // =================================================
                // LÊ RESPOSTA DA CRIAÇÃO
                // =================================================

                const textoCriacao =
                    await respostaCriacao.text();


                let dadosCriacao;


                try {

                    dadosCriacao =
                        JSON.parse(
                            textoCriacao
                        );

                }
                catch {

                    dadosCriacao = {

                        resposta:
                            textoCriacao

                    };

                }


                console.log(
                    "Status criação:",
                    respostaCriacao.status
                );


                console.log(
                    "Resposta criação:",
                    JSON.stringify(
                        dadosCriacao,
                        null,
                        2
                    )
                );


                // =================================================
                // VERIFICA CRIAÇÃO
                // =================================================

                if(
                    !respostaCriacao.ok ||
                    dadosCriacao.error === true ||
                    dadosCriacao.success === false
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            etapa:
                                "criacao",

                            mensagem:
                                "Erro ao criar chamado no TomTicket.",

                            status_tomticket:
                                respostaCriacao.status,

                            resposta_tomticket:
                                dadosCriacao
                        },

                        500

                    );

                }


                // =================================================
                // PEGA ID DO CHAMADO
                // =================================================

                const ticket_id =

                    dadosCriacao.ticket_id ||

                    dadosCriacao.id ||

                    dadosCriacao.data?.ticket_id ||

                    dadosCriacao.data?.id;


                if(
                    !ticket_id
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            etapa:
                                "criacao",

                            mensagem:
                                "Chamado criado, mas o TomTicket não retornou o ticket_id.",

                            tomticket:
                                dadosCriacao
                        },

                        500

                    );

                }


                console.log(
                    "Ticket criado:",
                    ticket_id
                );


                // =================================================
                // 2. GERA LINK DE CONCLUSÃO
                // =================================================

                const linkConclusao =
                    CONCLUIR_URL +
                    "?id=" +
                    encodeURIComponent(
                        String(ticket_id)
                    );


                console.log(
                    "Link de conclusão:",
                    linkConclusao
                );


                // =================================================
                // 3. ENVIA LINK PARA O MESMO CHAMADO
                // =================================================
                //
                // Esta mensagem aparece ABAIXO da solicitação.
                //
                // =================================================

                const dadosLink =
                    new URLSearchParams();


                dadosLink.append(
                    "ticket_id",
                    String(
                        ticket_id
                    )
                );


                dadosLink.append(
                    "message",

                    "🔗 CONCLUIR SOLICITAÇÃO:\n\n" +
                    linkConclusao
                );


                console.log(
                    "Enviando link de conclusão ao chamado..."
                );


                const respostaLink =
                    await fetch(

                        "https://api.tomticket.com/v2.0/ticket/reply/customer",

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "Authorization":
                                    `Bearer ${env.TOMTICKET_TOKEN}`

                            },

                            body:
                                dadosLink.toString()

                        }

                    );


                // =================================================
                // LÊ RESPOSTA DO LINK
                // =================================================

                const textoLink =
                    await respostaLink.text();


                let dadosLinkResultado;


                try {

                    dadosLinkResultado =
                        JSON.parse(
                            textoLink
                        );

                }
                catch {

                    dadosLinkResultado = {

                        resposta:
                            textoLink

                    };

                }


                console.log(
                    "Status link:",
                    respostaLink.status
                );


                console.log(
                    "Resposta link:",
                    JSON.stringify(
                        dadosLinkResultado,
                        null,
                        2
                    )
                );


                // =================================================
                // VERIFICA LINK
                // =================================================

                if(
                    !respostaLink.ok ||
                    dadosLinkResultado.error === true ||
                    dadosLinkResultado.success === false
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            etapa:
                                "link_conclusao",

                            mensagem:
                                "Chamado criado, mas não foi possível inserir o link de conclusão.",

                            chamado_criado:
                                true,

                            ticket_id:
                                ticket_id,

                            local_code:
                                codigo,

                            local:
                                local,

                            link_conclusao:
                                linkConclusao,

                            resposta_tomticket:
                                dadosLinkResultado
                        },

                        500

                    );

                }


                // =================================================
                // 4. TRANSFERÊNCIA
                // =================================================

                const transferencia =
                    new URLSearchParams();


                transferencia.append(
                    "ticket_id",
                    String(
                        ticket_id
                    )
                );


                transferencia.append(
                    "department_id",
                    DEPARTMENT_ID
                );


                console.log(
                    "Transferindo chamado..."
                );


                const respostaTransferencia =
                    await fetch(

                        "https://api.tomticket.com/v2.0/ticket/transfer",

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "Authorization":
                                    `Bearer ${env.TOMTICKET_TOKEN}`

                            },

                            body:
                                transferencia.toString()

                        }

                    );


                // =================================================
                // LÊ TRANSFERÊNCIA
                // =================================================

                const textoTransferencia =
                    await respostaTransferencia.text();


                let dadosTransferencia;


                try {

                    dadosTransferencia =
                        JSON.parse(
                            textoTransferencia
                        );

                }
                catch {

                    dadosTransferencia = {

                        resposta:
                            textoTransferencia

                    };

                }


                console.log(
                    "Status transferência:",
                    respostaTransferencia.status
                );


                console.log(
                    "Resposta transferência:",
                    JSON.stringify(
                        dadosTransferencia,
                        null,
                        2
                    )
                );


                // =================================================
                // VERIFICA TRANSFERÊNCIA
                // =================================================

                const transferenciaOK =

                    respostaTransferencia.ok &&

                    dadosTransferencia.error !== true &&

                    dadosTransferencia.success !== false;


                if(
                    !transferenciaOK
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            etapa:
                                "transferencia",

                            mensagem:
                                "O chamado foi criado e recebeu o link, mas a transferência para o departamento falhou.",

                            chamado_criado:
                                true,

                            ticket_id:
                                ticket_id,

                            local_code:
                                codigo,

                            local:
                                local,

                            link_conclusao:
                                linkConclusao,

                            criacao:
                                dadosCriacao,

                            link:
                                dadosLinkResultado,

                            transferencia: {

                                http_status:
                                    respostaTransferencia.status,

                                resposta:
                                    dadosTransferencia
                            }
                        },

                        500

                    );

                }


                // =================================================
                // SUCESSO FINAL
                // =================================================

                return respostaJSON({

                    sucesso:
                        true,

                    mensagem:
                        "Chamado criado, link de conclusão inserido e chamado transferido para o departamento sem atendente.",

                    ticket_id:
                        ticket_id,

                    local_code:
                        codigo,

                    local:
                        local,

                    subject:
                        assuntoOficial,

                    link_conclusao:
                        linkConclusao,

                    department_id:
                        DEPARTMENT_ID,

                    operator_id_enviado:
                        false,

                    criacao:
                        dadosCriacao,

                    link:
                        dadosLinkResultado,

                    transferencia: {

                        http_status:
                            respostaTransferencia.status,

                        resposta:
                            dadosTransferencia
                    }

                });


            }
            catch(error){

                console.error(
                    "ERRO NA API:",
                    error
                );


                return respostaJSON(

                    {
                        sucesso: false,

                        etapa:
                            "worker",

                        mensagem:
                            "Erro interno ao processar a solicitação.",

                        erro:
                            error.message
                    },

                    500

                );

            }

        }


        // ========================================================
        // CONCLUSÃO DA SOLICITAÇÃO
        // ========================================================

        if(
            request.method === "POST" &&
            url.pathname === "/concluir"
        ){

            try {


                // =================================================
                // RECEBE JSON
                // =================================================

                const body =
                    await request.json();


                const ticket_id =
                    String(
                        body.ticket_id || ""
                    ).trim();


                const nome =
                    String(
                        body.nome || ""
                    ).trim();


                console.log(
                    "Conclusão recebida:",
                    JSON.stringify({

                        ticket_id:
                            ticket_id,

                        nome:
                            nome

                    })
                );


                // =================================================
                // VALIDAÇÃO
                // =================================================

                if(
                    !ticket_id
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "ID do chamado não informado."
                        },

                        400

                    );

                }


                if(
                    nome.length < 2
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "Nome da colaboradora não informado."
                        },

                        400

                    );

                }


                // =================================================
                // TOKEN
                // =================================================

                if(
                    !env.TOMTICKET_TOKEN
                ){

                    console.error(
                        "TOMTICKET_TOKEN não configurado."
                    );


                    return respostaJSON(

                        {
                            sucesso: false,

                            mensagem:
                                "Token do TomTicket não configurado na API."
                        },

                        500

                    );

                }


                // =================================================
                // MENSAGEM DE CONCLUSÃO
                // =================================================

                const mensagem =
                    "Solicitação concluída.\n\n" +
                    "Realizado por: " +
                    nome;


                // =================================================
                // DADOS DA RESPOSTA
                // =================================================

                const dados =
                    new URLSearchParams();


                dados.append(
                    "ticket_id",
                    ticket_id
                );


                dados.append(
                    "message",
                    mensagem
                );


                console.log(
                    "Enviando conclusão ao TomTicket..."
                );


                console.log(
                    "Ticket:",
                    ticket_id
                );


                console.log(
                    "Mensagem:",
                    mensagem
                );


                // =================================================
                // RESPONDE O MESMO CHAMADO
                // =================================================

                const resposta =
                    await fetch(

                        "https://api.tomticket.com/v2.0/ticket/reply/customer",

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/x-www-form-urlencoded",

                                "Authorization":
                                    `Bearer ${env.TOMTICKET_TOKEN}`

                            },

                            body:
                                dados.toString()

                        }

                    );


                // =================================================
                // LÊ RESPOSTA
                // =================================================

                const texto =
                    await resposta.text();


                let resultado;


                try {

                    resultado =
                        JSON.parse(
                            texto
                        );

                }
                catch {

                    resultado = {

                        resposta:
                            texto

                    };

                }


                console.log(
                    "Status resposta TomTicket:",
                    resposta.status
                );


                console.log(
                    "Resposta TomTicket:",
                    JSON.stringify(
                        resultado,
                        null,
                        2
                    )
                );


                // =================================================
                // VERIFICAÇÃO
                // =================================================

                if(
                    !resposta.ok ||
                    resultado.error === true ||
                    resultado.success === false
                ){

                    return respostaJSON(

                        {
                            sucesso: false,

                            etapa:
                                "resposta_tomticket",

                            mensagem:
                                "TomTicket recusou a conclusão.",

                            ticket_id:
                                ticket_id,

                            status_tomticket:
                                resposta.status,

                            resposta_tomticket:
                                resultado,

                            texto_tomticket:
                                texto
                        },

                        500

                    );

                }


                // =================================================
                // SUCESSO
                // =================================================

                return respostaJSON({

                    sucesso:
                        true,

                    mensagem:
                        "Solicitação concluída com sucesso.",

                    ticket_id:
                        ticket_id,

                    nome:
                        nome,

                    resposta_id:
                        resultado.id || null,

                    tomticket:
                        resultado

                });


            }
            catch(error){

                console.error(
                    "ERRO NA CONCLUSÃO:",
                    error
                );


                return respostaJSON(

                    {
                        sucesso: false,

                        etapa:
                            "concluir",

                        mensagem:
                            "Erro interno ao processar a conclusão.",

                        erro:
                            error.message
                    },

                    500

                );

            }

        }


        // ========================================================
        // ROTA NÃO ENCONTRADA
        // ========================================================

        return respostaJSON(

            {
                sucesso: false,

                mensagem:
                    "Rota não encontrada."
            },

            404

        );

    }

};
