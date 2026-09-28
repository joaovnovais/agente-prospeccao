// Re-checa o contador no banco antes de cada lead: para de gastar IA/Reacher quando o limite do dia fecha.
const s = $input.first().json || {};
const lim = $('Calcular limite do dia').first().json;
const enviados = Number(CONFIG.modoTeste.ativo ? s.total_hoje_teste : s.total_hoje) || 0;
return [{ json: { cabe: enviados < lim.limite, enviados, limite: lim.limite, lead: $('Loop leads').first().json } }];
