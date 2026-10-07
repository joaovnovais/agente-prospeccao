// Watchdog: janela "hoje" em America/Sao_Paulo (roda 10:15 BRT, depois do envio das 09:30).
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.agenda.fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const inicio = new Date(`${ymd}T00:00:00${CONFIG.agenda.fusoOffset}`).toISOString();
const dow = new Date(`${ymd}T12:00:00${CONFIG.agenda.fusoOffset}`).getUTCDay();
// Segunda-feira: o resumo ganha o bloco semanal (taxa de e-mail confirmado por nicho).
return [{ json: { dia: ymd, inicio, diaUtil: dow >= 1 && dow <= 5, semanal: dow === 1 } }];
