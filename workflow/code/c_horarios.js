// Passo 6: monta a proposta de reunião com horários livres reais do Google Calendar (datas nunca vêm da IA).
const fb = $input.first().json;
const ctx = $('Contexto da resposta').first().json;
const d = $('Decidir próxima ação').first().json;
const A = CONFIG.agenda;
const calendarioOk = !fb.error && fb.calendars?.primary && !fb.calendars.primary.errors;
// Calendar sem autorização/erro: não responde o lead sem horários (viraria um ciclo de "qual o melhor dia?");
// vai para revisão manual com a resposta completa no Trello (correção da Fase 1, achado de 07/10).
if (!calendarioOk) {
  const erro = fb.error?.message || fb.error || fb.calendars?.primary?.errors || 'resposta inesperada do freeBusy';
  return [{ json: { calendario_falhou: true, erro: String(typeof erro === 'string' ? erro : JSON.stringify(erro)).slice(0, 300) } }];
}
const busy = fb.calendars.primary.busy || [];

const fmt = (dt) => new Intl.DateTimeFormat('pt-BR', { timeZone: A.fuso, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(dt).replace(/, (\d{2}:\d{2})$/, ' às $1');
const opcoes = [];
if (calendarioOk) {
  for (let k = 1; k <= A.diasAFrente && opcoes.length < A.opcoes; k++) {
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: A.fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + k * 864e5));
    const dow = new Date(`${ymd}T12:00:00${A.fusoOffset}`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    for (const h of A.horarios) {
      const ini = new Date(`${ymd}T${h}:00${A.fusoOffset}`);
      const fim = new Date(ini.getTime() + A.duracaoMin * 60e3);
      if (busy.some((b) => new Date(b.start) < fim && new Date(b.end) > ini)) continue;
      opcoes.push({ inicio: ini.toISOString(), fim: fim.toISOString(), label: fmt(ini) });
      break; // no máximo 1 opção por dia, para espalhar
    }
  }
}

const blocoHorarios = opcoes.length
  ? `Tenho estes horários disponíveis para a reunião de diagnóstico (${A.duracaoMin} min, online pelo Google Meet):\n` +
    opcoes.map((o, i) => `${i + 1}) ${o.label}`).join('\n') +
    '\n\nÉ só responder com o número da opção que funciona melhor — ou sugerir outro horário.'
  : 'Qual o melhor dia e horário para você nos próximos dias? Assim já envio o convite da reunião.';
const texto = `${d.q.resposta_sugerida}\n\n${blocoHorarios}\n\n${CONFIG.remetente.assinatura}`;
return [{ json: {
  destino: ctx.resposta.from,
  assunto: assuntoResposta(ctx.envio.assunto),
  texto, html: textoParaHtml(texto),
  opcoes, calendarioOk,
} }];
