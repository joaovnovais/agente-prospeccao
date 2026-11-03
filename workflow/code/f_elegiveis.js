// Quem recebe toque 2/3 hoje (regras em elegiveisFollowup) e quantos cabem (tetoFollowupDia, limite compartilhado com o envio frio).
const ini = $('FU: início').first().json;
const st = $('FU: status envio').first().json || {};
const envios = $('FU: envios').all().map((i) => i.json).filter((e) => e && e.id);
const comResposta = new Set($('FU: respostas').all().map((i) => i.json && i.json.lead_id).filter(Boolean));
// Limite do dia pela mesma regra do envio frio (b_limite_dia.js), medida às 09:30.
const r = CONFIG.rampUpEnviosPorDia;
let limite = r[0];
if (st.primeiro_envio) {
  const envio930 = new Date(`${ini.hoje}T09:30:00${CONFIG.agenda.fusoOffset}`).getTime();
  limite = r[Math.min(Math.max(Math.floor((envio930 - Date.parse(st.primeiro_envio)) / (7 * 864e5)) + 1, 1), r.length) - 1];
}
const { escolhidos, fora } = elegiveisFollowup(envios, comResposta, ini.hoje);
const teto = tetoFollowupDia(ini.estagio, limite, enviadosReaisHoje(st), ini.hoje);
const resumo = { estagio: ini.estagio, hoje: ini.hoje, limite, enviadosHoje: enviadosReaisHoje(st), teto, elegiveis: escolhidos.length, fora };
// Sombra: todos os elegíveis viram registro; só os primeiros "teto" ganham texto da IA. Teste/ligado: só os primeiros "teto".
const lista = ini.estagio === 'sombra' ? escolhidos : escolhidos.slice(0, teto);
if (!lista.length) return [{ json: { vazio: true, resumo } }];
return lista.map((e, i) => ({ json: { ...e, ordem: i + 1, gerarTexto: i < teto, estagio: ini.estagio, hoje: ini.hoje, resumo } }));
