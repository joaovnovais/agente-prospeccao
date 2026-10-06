// Watchdog: resumo diário do Robson para o João (nunca para prospect). Se este e-mail não chegar, o silêncio é o alerta.
if (!CONFIG.alertaDestino) throw new Error('config.alertaDestino vazio: watchdog sem destinatário.');
const linhasDe = (no) => $(no).all().map((i) => i.json).filter((r) => r && Object.keys(r).length);
const j = $('Janela de hoje').first().json;
const st = linhasDe('W: status envio')[0] || {};
const envios = linhasDe('W: envios hoje').filter((e) => e.tipo === 'prospeccao');
const reais = envios.filter((e) => !e.teste && e.status === 'enviado').length;
const comErro = envios.filter((e) => e.status !== 'enviado').length;
const verificados = linhasDe('W: verificados hoje').length;
const contatos = linhasDe('W: contatos hoje');
const safeHoje = contatos.filter((c) => c.reacher_status === 'safe').length;
const ia = Number((linhasDe('W: uso API hoje').find((u) => u.servico === 'openrouter') || {}).chamadas || 0);
const respostas = linhasDe('W: respostas hoje').length;
const filaSemVerificacao = linhasDe('W: fila sem verificação').length;
const contatosPendentes = linhasDe('W: contatos pendentes').length;

// Limite do dia pela mesma regra de b_limite_dia.js, medida no horário do envio (09:30 BRT).
const r = CONFIG.rampUpEnviosPorDia;
let limite = r[0];
if (st.primeiro_envio) {
  const envio930 = new Date(`${j.dia}T09:30:00${CONFIG.agenda.fusoOffset}`).getTime();
  const semana = Math.floor((envio930 - new Date(st.primeiro_envio).getTime()) / (7 * 864e5)) + 1;
  limite = r[Math.min(Math.max(semana, 1), r.length) - 1];
}

const alertas = [];
if (j.diaUtil && reais === 0) alertas.push('0 e-mails hoje');
if (j.diaUtil && verificados === 0) alertas.push('0 leads verificados hoje');
if (comErro) alertas.push(`${comErro} envio(s) com erro`);
if (ia >= CONFIG.limiteDiarioOpenRouter) alertas.push('cota de IA esgotada');
const assunto = alertas.length ? `[ALERTA Robson] ${alertas.join(' · ')}` : `[Robson] ${reais} e-mail${reais === 1 ? '' : 's'} hoje`;

const texto = [
  `Resumo do Robson — ${j.dia.split('-').reverse().join('/')}${j.diaUtil ? '' : ' (fim de semana)'}`,
  '',
  `E-mails enviados (reais): ${reais} de ${limite} (limite do ramp-up)`,
  `Envios com erro: ${comErro}`,
  `Leads verificados: ${verificados}`,
  `Contatos confirmados (safe) hoje: ${safeHoje}`,
  `Chamadas de IA: ${ia} de ${CONFIG.limiteDiarioOpenRouter}`,
  `Respostas recebidas: ${respostas}`,
  '',
  `Fila para o próximo envio: ${contatosPendentes} contato(s) confirmado(s) · ${filaSemVerificacao} lead(s) sem verificação`,
  alertas.length ? `\nALERTAS: ${alertas.join('; ')}` : '',
  '',
  'Painel de execuções: https://hooks.novax.ia.br/workflow/prspAgenteProsp1/executions',
].join('\n');

return [{ json: { destino: CONFIG.alertaDestino, assunto, texto, html: textoParaHtml(texto), alertas,
  numeros: { reais, comErro, limite, verificados, safeHoje, ia, respostas, filaSemVerificacao, contatosPendentes } } }];
