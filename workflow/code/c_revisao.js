// Salvaguarda 2 (respostas): IA inválida após retries, cota esgotada, fora do escopo ou falha no Calendar → revisão manual.
const j = $input.first().json;
const cotaEsgotada = j.cota_esgotada || (j.ok === false && j.tentativa === undefined);
// 03/11: reserva de cota que falhou por rede (depois de 3 tentativas) chega como { error } sem "ok".
const reservaFalhou = !!j.error && j.ok === undefined && j.tentativa === undefined;
const ctx = $('Contexto da resposta').first().json;
let motivo;
if (reservaFalhou) motivo = 'reserva da cota de IA falhou (Supabase indisponível) — qualificar a resposta manualmente';
else if (cotaEsgotada) motivo = 'cota diária da OpenRouter esgotada — qualificar a resposta manualmente';
else if (j.acao === 'revisao') motivo = 'resposta fora do escopo: ' + (j.q?.resumo || '');
else if (j.calendario_falhou) motivo = 'Google Calendar indisponível ao propor horários (responder o lead à mão): ' + j.erro;
else if (j.evento_ok === false) motivo = 'falha ao criar evento no Google Calendar: ' + j.erro;
else motivo = `IA inválida após ${j.tentativa} tentativa(s) [${j.tipo_falha}]: ${j.erro}`;
return [{ json: {
  lead: ctx.lead,
  acao_v1: 'revisao_manual',
  lead_patch: { status: 'revisao_manual', motivo_revisao: motivo.slice(0, 500) },
  trello_lista: CONFIG.trello.revisaoManual,
  trello_nome: `[REVISÃO] ${ctx.lead.nome} — ${ctx.lead.cidade}/${ctx.lead.estado}`,
  trello_desc: `**Motivo:** ${motivo}\n\n**Resposta do prospect (${ctx.resposta.from}):**\n${ctx.resposta.texto}` +
               (j.raw ? '\n\n**Última saída bruta da IA:**\n```\n' + String(j.raw).slice(0, 2000) + '\n```' : ''),
} }];
