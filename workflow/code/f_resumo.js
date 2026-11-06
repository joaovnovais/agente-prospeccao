// Resumo do dia para o João (nunca para lead). Sombra: até sombraTextosNoEmail textos para aprovação.
// 06/11: "FU: registro" e "FU: resultado" rodam uma vez por volta do loop, e $(n).all() sem índice devolve só a
// ÚLTIMA rodada (o resumo de 06/11 disse "0 texto(s)" com 8 textos gravados). Juntamos todas as rodadas:
// $(n).all(0, r) para r = 0, 1, … até o n8n lançar "Run r of node … not found".
if (!CONFIG.alertaDestino) throw new Error('config.alertaDestino vazio');
const limpar = (arr) => (arr || []).map((i) => i && i.json).filter((x) => x && Object.keys(x).length);
const doNo = (n) => { try { return limpar($(n).all()); } catch (e) { return []; } };
const todasRodadas = (n) => {
  const out = [];
  for (let r = 0; r < 5000; r++) {
    let itens;
    try { itens = $(n).all(0, r); } catch (e) { break; }
    if (!itens) break;
    out.push(...limpar(itens));
  }
  return out;
};
const resumo = (doNo('FU: elegíveis')[0] || {}).resumo || {};
const regs = todasRodadas('FU: registro').map((x) => x.registro).filter(Boolean);
const envios = todasRodadas('FU: resultado').map((x) => x.envio).filter(Boolean);
const comTexto = regs.filter((r) => r.corpo);
const semTextoTeto = regs.filter((r) => r.erro === 'sem texto (teto da sombra)').length;
const falhas = regs.filter((r) => r.erro && r.erro !== 'sem texto (teto da sombra)');
const enviados = envios.filter((e) => e.status === 'enviado').length;
const estagio = resumo.estagio || CONFIG.modulos.followup.estagio;
const n = resumo.elegiveis ?? 0;
const assunto = `[Robson follow-up · ${estagio}] ${resumo.hoje || ''}: ${n} elegíve${n === 1 ? 'l' : 'is'}`
  + (estagio === 'sombra' ? `, ${comTexto.length} texto(s)` : `, ${enviados} enviado(s)`) + (falhas.length ? `, ${falhas.length} falha(s)` : '');
const noEmail = comTexto.slice(0, CONFIG.followup.sombraTextosNoEmail);
const linhas = [
  `Follow-up do Robson — ${resumo.hoje || ''} (estágio ${estagio})`, '',
  `Limite do dia: ${resumo.limite ?? '-'} · já enviados antes do follow-up: ${resumo.enviadosHoje ?? 0} · teto do follow-up: ${resumo.teto ?? '-'}`,
  `Elegíveis: ${n}` + (resumo.fora && Object.keys(resumo.fora).length ? ' · fora: ' + Object.entries(resumo.fora).map(([k, v]) => `${k} ${v}`).join(', ') : ''),
  estagio === 'sombra'
    ? `Nada foi enviado (sombra). Registros gravados: ${regs.length} (${comTexto.length} com texto, ${semTextoTeto} sem texto pelo teto da sombra, ${falhas.length} falha(s)).`
    : `Enviados: ${enviados} de ${envios.length}${estagio === 'teste' ? ' (redirecionados para você)' : ''}.`,
];
if (falhas.length) linhas.push(`Falhas: ${falhas.map((f) => `toque ${f.toque}: ${String(f.erro).slice(0, 160)}`).join(' | ')}`);
if (comTexto.length) linhas.push('', `Textos neste e-mail: ${noEmail.length} de ${comTexto.length}`
  + (comTexto.length > noEmail.length ? ' (os demais estão em prospeccao_followup_sombra).' : '.'));
for (const [i, t] of noEmail.entries()) {
  linhas.push('', `— Texto ${i + 1} (toque ${t.toque}, ${t.dias_uteis} dias úteis desde o 1º e-mail) · ${t.assunto}`, t.corpo);
}
const texto = linhas.join('\n');
return [{ json: { destino: CONFIG.alertaDestino, assunto, texto, html: textoParaHtml(texto),
  contagem: { registros: regs.length, comTexto: comTexto.length, noEmail: noEmail.length, falhas: falhas.length, enviados } } }];
