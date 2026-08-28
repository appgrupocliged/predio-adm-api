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
    "https://appgrupocliged.github.io/predio-adm/concluir.html";


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
        // CONSULTA STATUS DO CHAMADO
        // ====================================================

        if(
            request.method === "GET" &&
            url.pathname === "/status"
        ){

            try {

                const ticket_id =
                    String(
                        url.searchParams.get(
                            "id"
                        ) || ""
                    ).trim();


                console.log(
                    "Consulta de status recebida:",
                    ticket_id
                );


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


                const urlTomTicket =
                    "https://api.tomticket.com/v2.0/ticket/detail" +
                    "?ticket_id=" +
                    encodeURIComponent(
                        ticket_id
                    );


                console.log(
                    "Consultando TomTicket:",
                    urlTomTicket
                );


                const respostaStatus =
                    await fetch(

                        urlTomTicket,

                        {

                            method:
                                "GET",

                            headers: {

                                "Authorization":
                                    `Bearer ${env.TOMTICKET_TOKEN}`,

                                "Accept":
                                    "application/json"

                            }

                        }

                    );


                const textoStatus =
                    await respostaStatus.text();


                let dadosStatus;


                try {

                    dadosStatus =
                        JSON.parse(
                            textoStatus
                        );

                }
                catch {

                    dadosStatus = {

                        resposta:
                            textoStatus

                    };

                }


                console.log(
                    "Status consulta TomTicket:",
                    respostaStatus.status
                );


                console.log(
                    "Resposta consulta completa:",
                    JSON.stringify(
                        dadosStatus,
                        null,
                        2
                    )
                );


                if(
                    !respostaStatus.ok ||
                    dadosStatus.error === true ||
                    dadosStatus.success === false
                ){

                    return respostaJSON(

                        {

                            sucesso: false,

                            etapa:
                                "consulta_status",

                            mensagem:
                                "Não foi possível consultar o chamado no TomTicket.",

                            ticket_id:
                                ticket_id,

                            status_tomticket:
                                respostaStatus.status,

                            resposta_tomticket:
                                dadosStatus

                        },

                        respostaStatus.status >= 400
                            ? respostaStatus.status
                            : 500

                    );

                }


                const dados =
                    dadosStatus.data ||
                    dadosStatus;


                console.log(
                    "DADOS DO CHAMADO:",
                    JSON.stringify(
                        dados,
                        null,
                        2
                    )
                );


                let statusObjeto =
                    dados.current_status ||
                    null;


                if(
                    !statusObjeto &&
                    dados.status &&
                    !Array.isArray(
                        dados.status
                    )
                ){

                    statusObjeto =
                        dados.status;

                }


                if(
                    !statusObjeto &&
                    dados.situation
                ){

                    statusObjeto =
                        dados.situation;

                }


                let status =
                    null;

                let statusId =
                    null;

                let statusApplyDate =
                    null;


                if(
                    typeof statusObjeto === "string"
                ){

                    status =
                        statusObjeto;

                }
                else if(
                    statusObjeto &&
                    typeof statusObjeto === "object"
                ){

                    status =
                        statusObjeto.description ||
                        statusObjeto.name ||
                        statusObjeto.status ||
                        null;


                    statusId =
                        statusObjeto.id ||
                        null;


                    statusApplyDate =
                        statusObjeto.apply_date ||
                        null;

                }


                if(
                    !status &&
                    Array.isArray(
                        dados.status
                    ) &&
                    dados.status.length > 0
                ){

                    const historico =
                        dados.status;


                    const ultimo =
                        historico[
                            historico.length - 1
                        ];


                    if(
                        ultimo
                    ){

                        status =
                            ultimo.description ||
                            ultimo.name ||
                            ultimo.status ||
                            null;


                        statusId =
                            ultimo.id ||
                            null;


                        statusApplyDate =
                            ultimo.apply_date ||
                            null;

                    }

                }


                const situacao =
                    dados.situation ||
                    null;


                let situationId =
                    null;

                let situationDescription =
                    null;

                let situationApplyDate =
                    null;


                if(
                    situacao &&
                    typeof situacao === "object"
                ){

                    situationId =
                        situacao.id ||
                        null;


                    situationDescription =
                        situacao.description ||
                        null;


                    situationApplyDate =
                        situacao.apply_date ||
                        null;

                }


                if(
                    !status &&
                    situationDescription
                ){

                    status =
                        situationDescription;

                }


                if(
                    !statusId &&
                    situationId
                ){

                    statusId =
                        situationId;

                }


                if(
                    !statusApplyDate &&
                    situationApplyDate
                ){

                    statusApplyDate =
                        situationApplyDate;

                }


                console.log(
                    "STATUS FINAL EXTRAÍDO:",
                    JSON.stringify({

                        status:
                            status,

                        status_id:
                            statusId,

                        status_apply_date:
                            statusApplyDate,

                        current_status:
                            dados.current_status ||
                            null,

                        situation:
                            dados.situation ||
                            null

                    },
                    null,
                    2)
                );


                const protocol =
                    dados.protocol ||
                    null;


                return respostaJSON({

                    sucesso:
                        true,

                    ticket_id:
                        ticket_id,

                    protocol:
                        protocol,

                    status:
                        status,

                    status_id:
                        statusId,

                    status_apply_date:
                        statusApplyDate,

                    situation_id:
                        situationId,

                    situation:
                        situationDescription,

                    situation_apply_date:
                        situationApplyDate,

                    subject:
                        dados.subject ||
                        null,

                    current_status:
                        dados.current_status ||
                        null,

                    data:
                        dados

                });

            }
            catch(error){

                console.error(
                    "ERRO AO CONSULTAR STATUS:",
                    error
                );


                return respostaJSON(

                    {

                        sucesso: false,

                        etapa:
                            "status",

                        mensagem:
                            "Erro interno ao consultar o status do chamado.",

                        erro:
                            error.message

                    },

                    500

                );

            }

        }


        // ====================================================
        // CRIAÇÃO DO CHAMADO
        // ====================================================

        if(
            request.method === "POST" &&
            url.pathname === "/solicitacao"
        ){

            try {

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


                const codigo =
                    String(
                        local_code
                    )
                    .toUpperCase()
                    .trim();


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


                const assuntoOficial =
                    "Solicitação - " +
                    local;


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


                /*
                =================================================
                MENSAGEM OFICIAL
                =================================================

                ALTERAÇÃO ÚNICA:

                Agora o código B.01-B.19 aparece uma única vez.

                Exemplo:

                Código do local: B.14
                Local: T.I

                Solicitação:
                - Papel higiênico

                =================================================
                */

                const mensagemOficial =
                    "Código do local: " +
                    codigo +
                    "\n" +
                    "Local: " +
                    local +
                    "\n\n" +
                    mensagemRecebida;


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


                const mensagem =
                    "Solicitação concluída.\n\n" +
                    "Realizado por: " +
                    nome;


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
                        resultado.id ||
                        null,

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
