// Passo 7: corpo do evento (Google Calendar API) com convite ao prospect e link do Meet.
const ctx = $('Contexto da resposta').first().json;
const d = $('Decidir próxima ação').first().json;
return [{ json: { body: {
  summary: `Diagnóstico Novax × ${ctx.lead.nome}`,
  description: `Reunião de diagnóstico gratuita (${CONFIG.agenda.duracaoMin} min).\n\nEmpresa: ${ctx.lead.nome} — ${ctx.lead.cidade}/${ctx.lead.estado}\nResumo: ${d.q.resumo}` +
               (ctx.envio.teste ? '\n\n[TESTE — agente de prospecção]' : ''),
  start: { dateTime: d.slot.inicio, timeZone: CONFIG.agenda.fuso },
  end: { dateTime: d.slot.fim, timeZone: CONFIG.agenda.fuso },
  attendees: [{ email: ctx.resposta.from }],
  conferenceData: { createRequest: { requestId: 'prsp-' + ctx.lead.id + '-' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
  reminders: { useDefault: true },
} } }];
