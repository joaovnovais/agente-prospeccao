// Passo 7: confirma que o horário escolhido continua livre antes de criar o evento.
const fb = $input.first().json;
const busy = fb.calendars?.primary?.busy;
return [{ json: { livre: !fb.error && Array.isArray(busy) && busy.length === 0 } }];
