// Salvaguardas 1 e 2: valida schema do JSON da IA; detecta recusa/desvio.
const ped = $('Pedido IA - e-mail').first().json;
let p = parseRespostaIA($input.first().json);

// Teste deliberado de resposta malformada (config modoTeste.forcarRespostaMalformadaNaTentativa).
if (CONFIG.modoTeste.forcarRespostaMalformadaNaTentativa === ped.tentativa) {
  p = parseTextoIA(RESPOSTA_MALFORMADA_TESTE);
  p.erro = '[TESTE FORÇADO] ' + p.erro;
}

const out = { lead: ped.lead, tentativa: ped.tentativa, messages: ped.messages, modelo: $input.first().json.model || null };
if (!p.ok) return [{ json: { ...out, ok: false, tipo_falha: p.tipo_falha, erro: p.erro, raw: String(p.raw).slice(0, 3000) } }];

const o = p.obj || {};
const erros = [];
const L = ped.lead;
const fallback = L.fila?.modo !== 'texto';
let cands = [];
if (fallback) {
  const limparEmail = (e) => String(e).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
  if (!Array.isArray(o.candidatos_email)) erros.push('candidatos_email ausente');
  const jaTestadas = new Set(variantesEmail(L.nome, L.cidade));
  // Só e-mails novos (as variações do nome já falharam na fase 1), sem duplicatas e sem Gmail impossível.
  cands = [...new Set((o.candidatos_email || []).map(limparEmail))]
    .filter((e) => EMAIL_RE.test(e) && emailPossivel(e) && !jaTestadas.has(e) && emailIdentificaEmpresa(e, L.nome, L.cidade));
}
if (typeof o.assunto !== 'string' || o.assunto.trim().length < 5 || o.assunto.length > 90) erros.push('assunto ausente ou fora de 5-90 caracteres');
if (typeof o.corpo !== 'string' || o.corpo.trim().length < 300 || o.corpo.length > 1800) erros.push('corpo ausente ou fora de 300-1800 caracteres');
if (typeof o.corpo === 'string') {
  if (/[\[\]{}]/.test(o.corpo)) erros.push('corpo contém placeholder entre colchetes/chaves');
  if (!/site/i.test(o.corpo)) erros.push('corpo não menciona a lacuna (site)');
  if (RECUSA_RE.test(o.corpo)) erros.push('corpo contém texto de recusa/meta-comentário da IA');
  const primeiroNome = norm(L.nome).split(' ').find((w) => w.length > 3) || '';
  if (primeiroNome && !norm(o.corpo).includes(primeiroNome)) erros.push('corpo não cita o nome da empresa');
  if (!norm(o.corpo).includes(norm(L.cidade))) erros.push('corpo não cita a cidade');
  erros.push(...checarFatos(o.corpo, L).map((e) => 'corpo ' + e));
}
if (typeof o.assunto === 'string') {
  const a = norm(o.assunto);
  const dados = [norm(L.cidade), norm(L.nome).split(' ').find((w) => w.length > 3), L.rating != null ? norm(fmtNota(L.rating)) : null,
                 L.total_avaliacoes ? String(L.total_avaliacoes) : null].filter(Boolean);
  if (!dados.some((d) => a.includes(d))) erros.push('assunto sem dado específico do lead (cidade, nome, nota ou avaliações)');
  if (/^presenca digital para/.test(a)) erros.push('assunto no padrão repetitivo "Presença digital para"');
  erros.push(...checarFatos(o.assunto, L).map((e) => 'assunto ' + e));
}
if (erros.length) {
  return [{ json: { ...out, ok: false, tipo_falha: 'schema', erro: 'schema inválido: ' + erros.join('; '), raw: String(p.raw).slice(0, 3000) } }];
}
return [{ json: { ...out, ok: true, candidatos: cands.slice(0, CONFIG.maxCandidatosEmail),
                  assunto: o.assunto.trim(), corpo: o.corpo.trim() } }];
