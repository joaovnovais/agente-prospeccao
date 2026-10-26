// 26/10: resposta da Verifalia → formato do Reacher ({ input, is_reachable }), que "Resultado verificação" e
// "Escolher melhor e-mail" já usam. Deliverable → safe; Undeliverable → invalid; Risky, Unknown e catch-all → unknown.
// 202 (ainda em andamento) → vale o GET de espera; se ele também não concluir, o item fica inconclusivo (conta no disjuntor).
// 402 → créditos do dia acabaram: sem_creditos (o fluxo encerra a verificação do dia, como "sem orçamento").
const corpo = (b) => { if (typeof b !== 'string') return b || {}; try { return JSON.parse(b); } catch (e) { return {}; } };
function resultadoVerifalia(email, post, espera) {
  const input = email ? String(email).toLowerCase() : null;
  if (!post || post.error || !post.statusCode) return { input, error: 'verifalia: sem resposta' };
  if (post.statusCode === 402) return { input, error: 'verifalia 402', sem_creditos: true };
  const r = post.statusCode === 202 ? espera : post;
  if (!r || r.error || r.statusCode !== 200) {
    return { input, error: `verifalia ${(r && r.statusCode) || 'sem resposta'}${post.statusCode === 202 ? ' (após 202)' : ''}` };
  }
  const e = ((corpo(r.body).entries || {}).data || [])[0];
  if (!e || !e.classification) return { input, error: 'verifalia: sem resultado' };
  const is_reachable = e.status === 'ServerIsCatchAll' ? 'unknown'
    : ({ Deliverable: 'safe', Undeliverable: 'invalid' })[e.classification] || 'unknown';
  return { input, is_reachable, verifalia: { classification: e.classification, status: e.status || null } };
}
const enviados = $(VERIFALIA_ENTRADA).all();
const esperas = $input.all();
const out = $(VERIFALIA_POST).all().map((p, i) => resultadoVerifalia(enviados[i] && enviados[i].json.email, p.json, esperas[i] && esperas[i].json));
// Marca o lote inteiro: o IF seguinte avalia item a item e o lote precisa ir todo para o mesmo lado.
const semCreditosLote = out.some((r) => r.sem_creditos);
return out.map((r) => ({ json: { ...r, semCreditosLote } }));
