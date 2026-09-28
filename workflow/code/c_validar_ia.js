// Salvaguardas 1 e 2 para a qualificação.
const ped = $('Pedido IA - qualificação').first().json;
const ctx = $('Contexto da resposta').first().json;
let p = parseRespostaIA($input.first().json);
if (CONFIG.modoTeste.forcarRespostaMalformadaNaTentativa === ped.tentativa) {
  p = parseTextoIA(RESPOSTA_MALFORMADA_TESTE);
  p.erro = '[TESTE FORÇADO] ' + p.erro;
}
const out = { lead: ctx.lead, tentativa: ped.tentativa, messages: ped.messages, modelo: $input.first().json.model || null };
if (!p.ok) return [{ json: { ...out, ok: false, tipo_falha: p.tipo_falha, erro: p.erro, raw: String(p.raw).slice(0, 3000) } }];

const o = p.obj || {};
const CLASSES = ['interessado', 'quer_mais_info', 'sem_interesse', 'descadastro', 'fora_do_escopo'];
const nOpcoes = (ctx.envio.classificacao_ia?.opcoes_horario || []).length;
const erros = [];
if (!CLASSES.includes(o.classificacao)) erros.push('classificacao fora do enum');
let esc = o.escolheu_horario;
if (esc !== null && esc !== undefined) {
  esc = Number(esc);
  if (!Number.isInteger(esc) || esc < 1 || esc > nOpcoes) erros.push('escolheu_horario inválido');
} else esc = null;
if (typeof o.resumo !== 'string') erros.push('resumo ausente');
const precisaTexto = ['interessado', 'quer_mais_info'].includes(o.classificacao);
if (precisaTexto) {
  const t = o.resposta_sugerida;
  if (typeof t !== 'string' || t.trim().length < 60 || t.length > 1200) erros.push('resposta_sugerida ausente ou fora de 60-1200 caracteres');
  else {
    if (/[\[\]{}]/.test(t)) erros.push('resposta_sugerida contém placeholder');
    if (RECUSA_RE.test(t)) erros.push('resposta_sugerida contém recusa/meta-comentário');
    erros.push(...checarFatos(t, ctx.lead).map((e) => 'resposta_sugerida ' + e));
  }
}
if (erros.length) return [{ json: { ...out, ok: false, tipo_falha: 'schema', erro: 'schema inválido: ' + erros.join('; '), raw: String(p.raw).slice(0, 3000) } }];

return [{ json: { ...out, ok: true, q: { classificacao: o.classificacao, escolheu_horario: esc,
  resumo: String(o.resumo).slice(0, 300), resposta_sugerida: precisaTexto ? o.resposta_sugerida.trim() : '' } } }];
