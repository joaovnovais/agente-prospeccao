// Mesmos guardas do envio frio (parse/recusa, fatos, elogio, acento) + regras do follow-up (checarCorpoFollowup).
const ped = $('FU: pedido IA').first().json;
const it = $('FU: loop').first().json;
const p = parseRespostaIA($input.first().json);
const out = { tentativa: ped.tentativa, messages: ped.messages, modelo: $input.first().json.model || null };
if (!p.ok) return [{ json: { ...out, ok: false, tipo_falha: p.tipo_falha, erro: p.erro, raw: String(p.raw).slice(0, 3000) } }];
const corpo = typeof (p.obj || {}).corpo === 'string' ? p.obj.corpo.trim() : '';
const erros = corpo ? checarCorpoFollowup(corpo, it.lead, it.toque, it.anteriores) : ['corpo ausente'];
if (erros.length) return [{ json: { ...out, ok: false, tipo_falha: 'schema', erro: 'texto inválido: ' + erros.join('; '), raw: String(p.raw).slice(0, 3000) } }];
return [{ json: { ...out, ok: true, corpo } }];
