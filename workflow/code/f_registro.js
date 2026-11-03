// Registro do dia em prospeccao_followup_sombra: texto da sombra, sem texto (teto da sombra), texto reprovado ou bloqueio.
// Fora da sombra, falha de texto também abre card de revisão no Trello (sem envio).
const it = $('FU: loop').first().json;
const j = $input.first().json || {};
let corpo = null, erro = null;
if (j.sombra === true && j.corpoIA) corpo = j.corpoIA;
else if (j.bloqueado === true) erro = 'contato bloqueado na hora do envio';
else if (it.gerarTexto === false) erro = 'sem texto (teto da sombra)';
else erro = String(j.erro || 'falha sem detalhe').slice(0, 1000);
const falhaTexto = !!erro && j.bloqueado !== true && it.gerarTexto !== false;
return [{ json: {
  registro: { dia: it.hoje, estagio: it.estagio, lead_id: it.lead.id, envio_inicial_id: it.inicial.id, envio_pai_id: it.pai.id,
    toque: it.toque, dias_uteis: it.du1, assunto: assuntoResposta(it.inicial.assunto), corpo, modelo: j.modelo || null, erro },
  trello: falhaTexto && it.estagio !== 'sombra' ? {
    nome: `[FOLLOW-UP] ${it.lead.nome} — toque ${it.toque} — ${it.lead.cidade}/${it.lead.estado}`,
    desc: `**Texto do toque ${it.toque} reprovado (sem envio):** ${erro}\n\n**Última saída bruta da IA:**\n${String(j.raw || '').slice(0, 1500)}`,
  } : null,
} }];
