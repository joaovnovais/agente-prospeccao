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
  // 13/10 (a): sem candidato aproveitável o lead vira sem_email de qualquer jeito; reprovar o texto só gastaria nova chamada
  // (11 das 18 novas tentativas de 07/10 foram assim). Segue direto para "Há candidatos novos?" → descarte.
  if (!cands.length) return [{ json: { ...out, ok: true, sem_candidato: true, candidatos: [], assunto: null, corpo: null } }];
}
// 13/10 (b): assunto "Presença digital para …" (8 das 18 novas tentativas de 07/10, apesar da regra no prompt) é trocado
// por um assunto padrão, sem nova chamada à IA. Copy v2: vale para qualquer assunto reprovado (formato, nota, padrão antigo)
// quando o nome tem até 4 palavras e o código monta sozinho o formato sorteado. As demais checagens valem para o assunto novo.
let assuntoCorrigido = false;
if (typeof o.assunto === 'string' && (/^presenca digital para/.test(norm(o.assunto)) || checarAssuntoV2(o.assunto, L).length) && assuntoPadrao(L)) {
  o.assunto = assuntoPadrao(L); assuntoCorrigido = true;
}
if (typeof o.assunto !== 'string' || o.assunto.trim().length < 5 || o.assunto.length > 90) erros.push('assunto ausente ou fora de 5-90 caracteres');
// Copy v2: limites do corpo (caracteres e palavras) vêm de CONFIG.corpoLimites, em checarCorpoV2.
if (typeof o.corpo !== 'string' || !o.corpo.trim()) erros.push('corpo ausente');
if (typeof o.corpo === 'string' && o.corpo.trim()) {
  erros.push(...checarCorpoV2(o.corpo, L));
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
  // Copy v2: o assunto usa a forma curta do nome, então vale qualquer palavra do nome (nota e avaliações saíram do assunto).
  const dados = [norm(L.cidade), ...norm(L.nome).split(' ').filter((w) => w.length > 3)].filter(Boolean);
  if (!dados.some((d) => a.includes(d))) erros.push('assunto sem dado específico do lead (cidade, nome, nota ou avaliações)');
  if (/^presenca digital para/.test(a)) erros.push('assunto no padrão repetitivo "Presença digital para"');
  if (ASSUNTO_SITE_EXISTE_RE.test(o.assunto)) erros.push('assunto sugere que a empresa já tem site');
  erros.push(...checarFatos(o.assunto, L).map((e) => 'assunto ' + e));
  erros.push(...checarAssuntoV2(o.assunto, L));
}
if (erros.length) {
  return [{ json: { ...out, ok: false, tipo_falha: 'schema', erro: 'schema inválido: ' + erros.join('; '), raw: String(p.raw).slice(0, 3000) } }];
}
return [{ json: { ...out, ok: true, candidatos: cands.slice(0, CONFIG.maxCandidatosEmail),
                  assunto: o.assunto.trim(), corpo: o.corpo.trim(), assunto_corrigido: assuntoCorrigido } }];
