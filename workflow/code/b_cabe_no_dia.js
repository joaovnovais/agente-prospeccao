// Re-checa o contador no banco antes de cada lead: para de gastar IA/Reacher quando o limite do dia fecha.
const s = $input.first().json || {};
const lim = $('Calcular limite do dia').first().json;
const enviados = CONFIG.modoTeste.ativo ? Number(s.total_hoje_teste) || 0 : enviadosReaisHoje(s);
return [{ json: { cabe: enviados < lim.limite, enviados, limite: lim.limite, lead: $('Loop leads').first().json } }];
