// Trava: o envio frio das 09:30 não pode competir com o follow-up. A partir de CONFIG.followup.pararAs (BRT) o loop para.
const agora = new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.agenda.fuso, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
return [{ json: { ...$input.first().json, aTempo: agora < CONFIG.followup.pararAs, agora } }];
