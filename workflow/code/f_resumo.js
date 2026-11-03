// Resumo do dia para o João (nunca para lead). Sombra: até sombraTextosNoEmail textos para aprovação.
if (!CONFIG.alertaDestino) throw new Error('config.alertaDestino vazio');
const doNo = (n) => { try { return $(n).all().map((i) => i.json).filter((x) => x && Object.keys(x).length); } catch (e) { return []; } };
const resumo = (doNo('FU: elegíveis')[0] || {}).resumo || {};
const regs = doNo('FU: registro').map((x) => x.registro).filter(Boolean);
const envios = doNo('FU: resultado').map((x) => x.envio).filter(Boolean);
const comTexto = regs.filter((r) => r.corpo);
const falhas = regs.filter((r) => r.erro && r.erro !== 'sem texto (teto da sombra)');
const enviados = envios.filter((e) => e.status === 'enviado').length;
const estagio = resumo.estagio || CONFIG.modulos.followup.estagio;
const n = resumo.elegiveis ?? 0;
const assunto = `[Robson follow-up · ${estagio}] ${resumo.hoje || ''}: ${n} elegíve${n === 1 ? 'l' : 'is'}`
  + (estagio === 'sombra' ? `, ${comTexto.length} texto(s)` : `, ${enviados} enviado(s)`) + (falhas.length ? `, ${falhas.length} falha(s)` : '');
const linhas = [
  `Follow-up do Robson — ${resumo.hoje || ''} (estágio ${estagio})`, '',
  `Limite do dia: ${resumo.limite ?? '-'} · já enviados antes do follow-up: ${resumo.enviadosHoje ?? 0} · teto do follow-up: ${resumo.teto ?? '-'}`,
  `Elegíveis: ${n}` + (resumo.fora && Object.keys(resumo.fora).length ? ' · fora: ' + Object.entries(resumo.fora).map(([k, v]) => `${k} ${v}`).join(', ') : ''),
  estagio === 'sombra' ? `Nada foi enviado (sombra). Registros gravados: ${regs.length}.`
    : `Enviados: ${enviados} de ${envios.length}${estagio === 'teste' ? ' (redirecionados para você)' : ''}.`,
];
if (falhas.length) linhas.push(`Falhas: ${falhas.map((f) => `toque ${f.toque}: ${String(f.erro).slice(0, 160)}`).join(' | ')}`);
for (const [i, t] of comTexto.slice(0, CONFIG.followup.sombraTextosNoEmail).entries()) {
  linhas.push('', `— Texto ${i + 1} (toque ${t.toque}, ${t.dias_uteis} dias úteis desde o 1º e-mail) · ${t.assunto}`, t.corpo);
}
const texto = linhas.join('\n');
return [{ json: { destino: CONFIG.alertaDestino, assunto, texto, html: textoParaHtml(texto) } }];
