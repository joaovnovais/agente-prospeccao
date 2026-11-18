// Resposta da Gmail API (users.messages.send) → linha de prospeccao_envios (tipo followup, mesma conversa do toque 1).
const it = $('FU: loop').first().json;
const m = $('FU: pode enviar?').first().json;
const r = $input.first().json || {};
const lerCorpo = (b) => { if (typeof b !== 'string') return b || {}; try { return JSON.parse(b); } catch (e) { return {}; } };
const corpoResp = lerCorpo(r.body);
const ok = r.statusCode === 200 && !!corpoResp.id;
return [{ json: { ok, gmailId: corpoResp.id || null, envio: {
  lead_id: it.lead.id, contato_id: it.inicial.contato_id, tipo: 'followup', toque: it.toque, envio_pai_id: it.pai.id,
  origem_modulo: 'followup', nicho: it.lead.nicho || null, assunto: m.assunto, corpo: m.texto,
  // 18/11: o Message-ID real não volta no envio (só id e threadId); message_id fica nulo para não gravar um ID que o lead não recebeu.
  message_id: null, gmail_id: corpoResp.id || null, gmail_thread_id: corpoResp.threadId || null,
  status: ok ? 'enviado' : 'erro',
  erro: ok ? null : `gmail ${r.statusCode || 'sem resposta'}: ${JSON.stringify(corpoResp.error || r.error || '').slice(0, 400)}`,
  teste: it.estagio === 'teste',
} } }];
