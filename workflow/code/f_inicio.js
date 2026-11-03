// Follow-up (prspFollowUp001), 09:00 BRT em dias úteis. Desligado ou feriado → sai no primeiro nó (nenhum item segue).
const estagio = CONFIG.modulos.followup.estagio;
if (!['sombra', 'teste', 'ligado'].includes(estagio)) return [];
const hoje = diaBRT(new Date());
if (!ehDiaUtil(hoje)) return [];
return [{ json: { estagio, hoje, inicio: new Date(`${hoje}T00:00:00${CONFIG.agenda.fusoOffset}`).toISOString() } }];
