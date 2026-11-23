// Casa a resposta com o envio original (via In-Reply-To/References = message_id salvo no envio).
const env = $input.first().json;
const r = $('Extrair resposta').first().json;
if (!env || !env.id || !env.lead) return [{ json: { acao: 'ignorar' } }];
if (env.resposta_message_id && env.resposta_message_id === r.message_id) return [{ json: { acao: 'ignorar' } }];

// 23/11: bounce (aviso de não entrega) não é resposta: não preenche os campos de resposta do envio
// (o envio não conta como respondido) e só registra o aviso em classificacao_ia.bounce. Vai para "Dados bounce".
if (r.bounce === true) {
  const bounce = { em: r.recebido_em, codigo: (r.bounce_dados || {}).codigo || null, email: (r.bounce_dados || {}).email || null, message_id: r.message_id };
  return [{ json: {
    acao: 'bounce',
    envio: { id: env.id, tipo: env.tipo, assunto: env.assunto, corpo: env.corpo, classificacao_ia: env.classificacao_ia || {}, teste: env.teste },
    lead: env.lead, contato: env.contato, resposta: r, bounce,
    resposta_patch: { classificacao_ia: Object.assign({}, env.classificacao_ia || {}, { bounce }) },
  } }];
}

// Descadastro explícito é tratado por regra fixa (não depende da IA).
const OPTOUT_RE = /(^\s*(sair|descadastrar|remover|pare|stop|unsubscribe)\s*[.!]?\s*$)|descadastr|me (remova|retire|tire) d|remov(a|er|am) (o )?(meu|nosso) (e-?mail|contato)|n[aã]o (quero|desejo) (mais )?receber|parem? de (me )?(enviar|mandar)|unsubscribe|tir(a|e|ar|em) (o )?(meu|nosso) (e-?mail|contato|nome)|sair da (sua |vossa )?lista|me (exclua|excluam|retirem)/im;
const optout = OPTOUT_RE.test(r.texto);

return [{ json: {
  acao: optout ? 'optout' : 'qualificar',
  envio: { id: env.id, tipo: env.tipo, assunto: env.assunto, corpo: env.corpo, classificacao_ia: env.classificacao_ia || {}, teste: env.teste },
  lead: env.lead,
  contato: env.contato,
  resposta: r,
  resposta_patch: { resposta_recebida_em: r.recebido_em, resposta_texto: r.texto, resposta_message_id: r.message_id },
} }];
