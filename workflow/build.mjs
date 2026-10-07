// Gera workflow/dist/novax-agente-prospeccao.json a partir de config.json + code/*.js.
// Uso: node workflow/build.mjs   (não contém nenhum segredo — credenciais são referenciadas por ID)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(DIR, 'config.json'), 'utf8'));
const LIB = readFileSync(join(DIR, 'code', '_lib.js'), 'utf8');
const REST = CONFIG.supabaseRest;
// Impressão digital do build (auditoria 2026-10-05): o deploy.sh confere que a versão no banco do n8n é ESTE build.
const BUILD_ID = (() => {
  const h = createHash('sha256').update(readFileSync(join(DIR, 'config.json'))).update(readFileSync(fileURLToPath(import.meta.url)));
  for (const f of readdirSync(join(DIR, 'code')).sort()) h.update(f).update(readFileSync(join(DIR, 'code', f)));
  return h.digest('hex').slice(0, 12);
})();

if (!CONFIG.modelos.every((m) => m.endsWith(':free'))) throw new Error('todo modelo precisa terminar em ":free"');
// Robson 2.0: flags de módulo/motor validadas no build (valor inesperado nunca chega à produção).
const ESTAGIOS = ['desligado', 'sombra', 'teste', 'ligado'];
for (const [m, v] of Object.entries(CONFIG.modulos || {})) if (!ESTAGIOS.includes(v.estagio)) throw new Error(`modulos.${m}.estagio inválido: ${v.estagio}`);
if (!['v1', 'v2'].includes(CONFIG.respostas?.motor)) throw new Error('respostas.motor precisa ser "v1" ou "v2"');
const MOTOR_V1 = CONFIG.respostas.motor === 'v1';

const CRED = {
  supabase: { supabaseApi: { id: 'prspSupabase0001', name: 'Supabase - Prospeccao' } },
  openrouter: { openRouterApi: { id: 'prspOpenRouter01', name: 'OpenRouter - Prospeccao' } },
  places: { httpHeaderAuth: { id: 'prspPlacesKey001', name: 'Google Places - Prospeccao' } },
  smtp: { smtp: { id: 'prspSmtpGmail001', name: 'Gmail SMTP - Prospeccao' } },
  imap: { imap: { id: 'prspImapGmail001', name: 'Gmail IMAP - Prospeccao' } },
  gcal: { googleCalendarOAuth2Api: { id: 'prspGCalendar001', name: 'Google Calendar - Prospeccao' } },
  trello: { trelloApi: { id: 'prspTrello000001', name: 'Trello - Prospeccao' } },
};

const nodes = [];
const connections = {};
const X = 240, Y = 180;

function add(name, type, typeVersion, parameters, [col, row], extra = {}) {
  if (nodes.some((n) => n.name === name)) throw new Error('nome duplicado: ' + name);
  nodes.push({ id: randomUUID(), name, type, typeVersion, position: [col * X, row * Y], parameters, ...extra });
  return name;
}
function link(from, to, out = 0) {
  if (!nodes.some((n) => n.name === from)) throw new Error('link de nó inexistente: ' + from);
  if (!nodes.some((n) => n.name === to)) throw new Error('link para nó inexistente: ' + to);
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= out) connections[from].main.push([]);
  connections[from].main[out].push({ node: to, type: 'main', index: 0 });
}
const chain = (...names) => names.slice(1).forEach((n, i) => link(names[i], n));

// ---------- fábricas de nós ----------
function code(name, file, pos, pre = '') {
  const src = readFileSync(join(DIR, 'code', file), 'utf8');
  const jsCode = `// ⚠ Gerado por workflow/build.mjs — edite o repo (config.json / code/${file}) e reimporte. build: ${BUILD_ID}\n` +
    `const CONFIG = ${JSON.stringify(CONFIG)};\n${pre}\n${LIB}\n${src}`;
  return add(name, 'n8n-nodes-base.code', 2, { mode: 'runOnceForAllItems', jsCode }, pos);
}
function http(name, pos, { method = 'GET', url, cred, credType, body, query, headers, timeout = 30000, always = false, soft = false, intervaloMs = 0, retry = false }) {
  const p = { method, url: url.includes('{{') && !url.startsWith('=') ? '=' + url : url, options: { timeout } };
  // Uma requisição por vez com pausa entre elas (rajadas de consulta SMTP fazem o Gmail segurar o IP: 141 timeouts/258 consultas).
  if (intervaloMs) p.options.batching = { batch: { batchSize: 1, batchInterval: intervaloMs } };
  if (cred === 'places') Object.assign(p, { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' });
  else if (credType) Object.assign(p, { authentication: 'predefinedCredentialType', nodeCredentialType: credType });
  if (query) Object.assign(p, { sendQuery: true, queryParameters: { parameters: Object.entries(query).map(([name, value]) => ({ name, value })) } });
  if (headers) Object.assign(p, { sendHeaders: true, headerParameters: { parameters: Object.entries(headers).map(([name, value]) => ({ name, value })) } });
  if (body) Object.assign(p, { sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: body });
  const extra = {};
  if (cred) extra.credentials = CRED[cred];
  if (always) extra.alwaysOutputData = true;
  if (soft) extra.onError = 'continueRegularOutput';
  if (retry) Object.assign(extra, { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 });
  return add(name, 'n8n-nodes-base.httpRequest', 4.2, p, pos, extra);
}
const supa = (name, pos, o) => http(name, pos, { ...o, url: REST + o.path, cred: 'supabase', credType: 'supabaseApi',
  headers: { Prefer: o.prefer || 'return=representation', ...(o.headers || {}) }, always: o.always ?? true });
function iff(name, expr, pos) {
  return add(name, 'n8n-nodes-base.if', 2.2, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: randomUUID(), leftValue: `={{ ${expr} }}`, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  }, pos);
}
const noop = (name, pos) => add(name, 'n8n-nodes-base.noOp', 1, {}, pos);
const wait = (name, amountExpr, pos) => add(name, 'n8n-nodes-base.wait', 1.1, { resume: 'timeInterval', amount: amountExpr, unit: 'seconds' }, pos, { webhookId: randomUUID() });
const loop = (name, pos) => add(name, 'n8n-nodes-base.splitInBatches', 3, { batchSize: 1, options: {} }, pos);
const schedule = (name, cron, pos) => add(name, 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: cron }] } }, pos);
function smtp(name, ref, pos) {
  return add(name, 'n8n-nodes-base.emailSend', 2.1, {
    fromEmail: `${CONFIG.remetente.nome} <${CONFIG.remetente.email}>`,
    toEmail: `={{ $('${ref}').first().json.destino }}`,
    subject: `={{ $('${ref}').first().json.assunto }}`,
    emailFormat: 'both',
    text: `={{ $('${ref}').first().json.texto }}`,
    html: `={{ $('${ref}').first().json.html }}`,
    options: { appendAttribution: false, replyTo: CONFIG.remetente.email },
  }, pos, { credentials: CRED.smtp, onError: 'continueRegularOutput' });
}
const openrouter = (name, pedido, pos) => http(name, pos, {
  method: 'POST', url: CONFIG.openRouterUrl, cred: 'openrouter', credType: 'openRouterApi', timeout: 90000, soft: true,
  headers: { 'HTTP-Referer': 'https://novax.ia.br', 'X-Title': 'NOVAX - Agente de Prospeccao' },
  body: `={{ JSON.stringify({ models: ${JSON.stringify(CONFIG.modelos)}, messages: $('${pedido}').first().json.messages, temperature: 0.4, max_tokens: 2000, reasoning: { enabled: false } }) }}`,
});
const reservarIA = (name, pos) => supa(name, pos, { method: 'POST', path: '/rpc/prospeccao_reservar_cota',
  body: `={{ JSON.stringify({ p_servico: 'openrouter', p_limite: ${CONFIG.limiteDiarioOpenRouter} }) }}` });

// Cauda comum B/C: grava envio (se houver) → atualiza lead → Trello (mover ou criar) → salva id do card.
function cauda(sfx, saida, row, fimLoop, depoisTrello, antes = null, depoisCard = depoisTrello) {
  const S = `$('${saida}').first().json`;
  const regQ = iff(`Registrar envio? ${sfx}`, `!!${S}.envio`, [1, row]);
  const reg = supa(`Registrar envio ${sfx}`, [2, row - 0.5], { method: 'POST', path: '/prospeccao_envios', body: `={{ JSON.stringify(${S}.envio) }}` });
  const upd = supa(`Atualizar lead ${sfx}`, [3, row], { method: 'PATCH', path: `/prospeccao_leads?id=eq.{{ ${S}.lead.id }}`, body: `={{ JSON.stringify(${S}.lead_patch) }}` });
  const trQ = iff(`Registrar no Trello? ${sfx}`, `!!${S}.trello_lista`, [4, row]);
  const cardQ = iff(`Tem card? ${sfx}`, `!!${S}.lead.trello_card_id`, [5, row]);
  const mover = add(`Trello - mover card ${sfx}`, 'n8n-nodes-base.trello', 1, {
    resource: 'card', operation: 'update',
    id: { __rl: true, value: `={{ ${S}.lead.trello_card_id }}`, mode: 'id' },
    updateFields: { idList: `={{ ${S}.trello_lista }}` },
  }, [6, row - 0.5], { credentials: CRED.trello, onError: 'continueRegularOutput' });
  const criar = add(`Trello - criar card ${sfx}`, 'n8n-nodes-base.trello', 1, {
    resource: 'card', operation: 'create',
    listId: `={{ ${S}.trello_lista }}`, name: `={{ ${S}.trello_nome }}`, description: `={{ ${S}.trello_desc || '' }}`,
    additionalFields: { pos: 'top' },
  }, [6, row + 0.5], { credentials: CRED.trello, onError: 'continueRegularOutput' });
  const salvar = supa(`Salvar card no lead ${sfx}`, [7, row], { method: 'PATCH', path: `/prospeccao_leads?id=eq.{{ ${S}.lead.id }}`,
    body: `={{ JSON.stringify({ trello_card_id: $json.id || ${S}.lead.trello_card_id || null }) }}` });
  if (antes) chain(saida, antes, regQ); else chain(saida, regQ);
  link(regQ, reg, 0); link(regQ, upd, 1); link(reg, upd);
  chain(upd, trQ); link(trQ, cardQ, 0); link(trQ, depoisTrello, 1);
  link(cardQ, mover, 0); link(cardQ, criar, 1); link(mover, salvar); link(criar, salvar); link(salvar, depoisCard);
  return fimLoop;
}

// ====================== TESTE MANUAL ======================
add('Teste manual', 'n8n-nodes-base.manualTrigger', 1, {}, [0, -3]);
code('Roteador de teste', '_roteador.js', [1, -3]);
iff('Teste: captação?', `$json.etapa === 'captacao'`, [2, -3]);
iff('Teste: envio?', `$json.etapa === 'envio'`, [3, -3]);
code('Resposta simulada', 't_resposta_simulada.js', [4, -3]);
chain('Teste manual', 'Roteador de teste', 'Teste: captação?');
link('Teste: captação?', 'Teste: envio?', 1);
link('Teste: envio?', 'Resposta simulada', 1);

// ====================== A. CAPTAÇÃO SEMANAL (passos 1-2) ======================
schedule('Semanal - Captação', '0 7 * * 1', [0, 0]);
supa('Buscar taxa de resposta', [1, 0], { path: '/prospeccao_taxa_resposta?select=*' });
code('Montar buscas da semana', 'a_montar_buscas.js', [2, 0]);
supa('Reservar cota Places', [3, 0], { method: 'POST', path: '/rpc/prospeccao_reservar_cota',
  body: `={{ JSON.stringify({ p_servico: 'google_places', p_limite: ${Math.min(CONFIG.limiteMensalPlaces, CONFIG.tetoMensalPlaces || CONFIG.limiteMensalPlaces)} }) }}` });
iff('Cota Places ok?', '$json.ok === true', [4, 0]);
noop('Cota Places esgotada', [5, 1]);
http('Places - Text Search', [5, 0], {
  method: 'POST', url: 'https://places.googleapis.com/v1/places:searchText', cred: 'places', soft: true,
  headers: { 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.primaryTypeDisplayName,places.types' },
  body: `={{ JSON.stringify({ textQuery: $('Montar buscas da semana').item.json.textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 }) }}`,
});
code('Filtrar sem site + exclusões', 'a_filtrar_places.js', [6, 0]);
iff('Há leads novos?', '$json.total > 0', [7, 0]);
supa('Upsert leads', [8, 0], { method: 'POST', path: '/prospeccao_leads?on_conflict=place_id',
  prefer: 'resolution=ignore-duplicates,return=representation', body: '={{ JSON.stringify($json.rows) }}', always: false });
code('Resumo captação', 'a_resumo.js', [9, 0]);
chain('Semanal - Captação', 'Buscar taxa de resposta', 'Montar buscas da semana', 'Reservar cota Places', 'Cota Places ok?');
link('Cota Places ok?', 'Places - Text Search', 0); link('Cota Places ok?', 'Cota Places esgotada', 1);
chain('Places - Text Search', 'Filtrar sem site + exclusões', 'Há leads novos?');
link('Há leads novos?', 'Upsert leads', 0); link('Upsert leads', 'Resumo captação');
link('Teste: captação?', 'Buscar taxa de resposta', 0);

// ====================== B. ENVIO DIÁRIO (passos 3-5, 8) ======================
// Fase 1 (sem IA): Reacher verifica as variações do nome. Fase 2: fila = leads com e-mail confirmado
// (IA só escreve o texto) + fallback (IA sugere e-mails alternativos) com a cota que sobrar.
schedule('Diário - Envio', '30 9 * * 1-5', [0, 4]);
supa('Status envios (dia)', [1, 4], { path: '/prospeccao_status_envio?select=*' });
code('Calcular limite do dia', 'b_limite_dia.js', [2, 4]);

supa('Buscar leads p/ verificação', [3, 2.4], { path: '/prospeccao_leads?select=*&status=eq.novo&verificacao_codigo_em=is.null&order=updated_at.asc,id.asc&limit={{ $json.loteVerificacao }}' });
iff('Há leads p/ verificar?', '!!$json.id', [4, 2.4]);
loop('Loop verificação', [5, 2.4]);
code('Variações do nome', 'b_variacoes.js', [6, 2.4]);
iff('Tem variação?', '!!$json.email', [7, 2.4]);
http('Reacher - variações do nome', [8, 2], { method: 'POST', url: CONFIG.reacherUrl, timeout: 90000, soft: true, intervaloMs: CONFIG.reacherIntervaloMs,
  body: '={{ JSON.stringify({ to_email: $json.email }) }}' });
code('Resultado verificação (código)', 'b_resultado_verificacao.js', [9, 2.4]);
iff('Reacher travou?', '$json.disjuntor === true', [10, 1.6]);
iff('E-mail do nome confirmado?', '$json.safe === true', [10, 2.4]);
wait('Pausa entre verificações', CONFIG.pausaEntreVerificacoesSeg, [13, 2.4]);
supa('Salvar contato verificado', [11, 2], { method: 'POST', path: '/prospeccao_contatos?on_conflict=email',
  prefer: 'resolution=merge-duplicates,return=representation',
  body: `={{ JSON.stringify({ lead_id: $json.lead.id, email: $json.email, origem: 'codigo_nome', reacher_status: 'safe', reacher_raw: $json.reacher, verificado_em: new Date().toISOString() }) }}` });
supa('Marcar verificação (lead)', [12, 2.4], { method: 'PATCH',
  path: `/prospeccao_leads?id=eq.{{ $('Resultado verificação (código)').first().json.lead.id }}`,
  body: `={{ JSON.stringify({ verificacao_codigo_em: $('Resultado verificação (código)').first().json.incompleto ? null : new Date().toISOString() }) }}` });
code('Fim da verificação', 'b_resumo_verificacao.js', [6, 3.2]);
supa('Buscar fila com e-mail', [7, 3.2], { path: `/prospeccao_leads?select=*,contatos:prospeccao_contatos!inner(id,email,reacher_status,reacher_raw,bloqueado)&status=eq.novo&contatos.reacher_status=eq.safe&contatos.bloqueado=is.false&order=created_at.asc,id.asc&limit={{ $('Calcular limite do dia').first().json.lote }}` });
supa('Buscar fila fallback', [8, 3.2], { path: `/prospeccao_leads?select=*&status=eq.novo&verificacao_codigo_em=not.is.null&order=total_avaliacoes.desc.nullslast,updated_at.asc,id.asc&limit={{ $('Calcular limite do dia').first().json.lote }}` });
code('Montar fila de envio', 'b_montar_fila.js', [9, 3.2]);
// 07/10: "Buscar fila fallback" recebe 1 item por lead com e-mail e rodava uma vez por item (120 itens para 30 leads).
for (const n of nodes) if (n.name === 'Buscar fila com e-mail' || n.name === 'Buscar fila fallback') n.executeOnce = true;

loop('Loop leads', [4, 4]);
supa('Status envios (lead)', [5, 4], { path: '/prospeccao_status_envio?select=*' });
code('Checar limite (lead)', 'b_cabe_no_dia.js', [6, 4]);
iff('Cabe no limite?', '$json.cabe === true', [7, 4]);
code('Pedido IA - e-mail', 'b_pedido_ia.js', [8, 4]);
reservarIA('Reservar cota IA (e-mail)', [9, 4]);
iff('Cota IA ok? (e-mail)', '$json.ok === true', [10, 4]);
noop('Parar: cota IA esgotada', [11, 5]);
iff('Teto do fallback?', '$json.teto_fallback === true', [8.5, 5]);
noop('Parar: teto do fallback', [9.5, 5.6]);
openrouter('OpenRouter - gerar e-mail', 'Pedido IA - e-mail', [11, 4]);
code('Validar resposta IA - e-mail', 'b_validar_ia.js', [12, 4]);
iff('JSON válido? (e-mail)', '$json.ok === true', [13, 4]);
iff('Ainda tem tentativa? (e-mail)', `$json.tentativa < ${CONFIG.maxTentativasIA}`, [13, 6]);
wait('Pausa retry (e-mail)', 15, [12, 7]);
code('Preparar retry - e-mail', '_retry.js', [10, 7]);
code('Revisão manual (e-mail)', 'b_revisao.js', [14, 7]);
iff('E-mail já confirmado?', `!!$json.lead.fila && $json.lead.fila.modo === 'texto'`, [14, 4]);
iff('Há candidatos novos?', '!!$json.candidatos && $json.candidatos.length > 0', [14, 5.2]);
code('Separar candidatos', 'b_separar_candidatos.js', [15, 5.2]);
http('Reacher - candidatos da IA', [16, 5.2], { method: 'POST', url: CONFIG.reacherUrl, timeout: 90000, soft: true, intervaloMs: CONFIG.reacherIntervaloMs,
  body: '={{ JSON.stringify({ to_email: $json.email }) }}' });
code('Escolher melhor e-mail', 'b_escolher_email.js', [17, 5.2]);
iff('Tem e-mail válido?', '$json.tem_email === true', [18, 5.2]);
code('Descartar lead', 'b_descarte.js', [19, 6.4]);
code('E-mail definido', 'b_email_definido.js', [18, 4]);
supa('Checar bloqueio LGPD', [19, 4], { path: '/prospeccao_contatos',
  query: { select: 'email', bloqueado: 'is.true', or: `={{ '(email.eq."' + $json.email + '",lead_id.eq.' + $json.lead.id + ')' }}` } });
code('Montar e-mail final', 'b_montar_email.js', [20, 4]);
iff('Bloqueado?', '$json.bloqueado === true', [21, 4]);
iff('Dry-run?', `${!!CONFIG.modoTeste.dryRun?.ativo} === true`, [21, 6]);
noop('Dry-run: não envia', [22, 6]);
supa('Upsert contato', [22, 4], { method: 'POST', path: '/prospeccao_contatos?on_conflict=email',
  prefer: 'resolution=merge-duplicates,return=representation',
  body: `={{ JSON.stringify({ lead_id: $json.lead.id, email: $json.email_real, origem: $json.origem || 'ia_candidato', reacher_status: $json.reacher.is_reachable, reacher_raw: $json.reacher, verificado_em: new Date().toISOString() }) }}` });
smtp('Enviar e-mail (SMTP)', 'Montar e-mail final', [23, 4]);
code('Resultado envio', 'b_resultado_envio.js', [24, 4]);
code('Saída (B)', '_saida.js', [0, 9], `const ORIGEM_FALLBACK = 'Resultado envio';`);
iff('Houve envio? (B)', `($('Saída (B)').first().json.envio || {}).status === 'enviado'`, [8, 9]);
wait('Espaçar envios', `={{ ${CONFIG.esperaEntreEnviosSeg[0]} + Math.floor(Math.random() * ${CONFIG.esperaEntreEnviosSeg[1] - CONFIG.esperaEntreEnviosSeg[0]}) }}`, [9, 9]);

chain('Diário - Envio', 'Status envios (dia)', 'Calcular limite do dia', 'Buscar leads p/ verificação', 'Há leads p/ verificar?');
link('Teste: envio?', 'Status envios (dia)', 0);
link('Há leads p/ verificar?', 'Loop verificação', 0); link('Há leads p/ verificar?', 'Fim da verificação', 1);
link('Loop verificação', 'Fim da verificação', 0); link('Loop verificação', 'Variações do nome', 1);
chain('Variações do nome', 'Tem variação?');
link('Tem variação?', 'Reacher - variações do nome', 0); link('Tem variação?', 'Resultado verificação (código)', 1);
chain('Reacher - variações do nome', 'Resultado verificação (código)', 'Reacher travou?');
// Disjuntor: consulta inconclusiva → encerra a fase 1 já (sem acumular timeouts) e segue p/ a fila com o que já foi confirmado.
link('Reacher travou?', 'Fim da verificação', 0); link('Reacher travou?', 'E-mail do nome confirmado?', 1);
link('E-mail do nome confirmado?', 'Salvar contato verificado', 0); link('E-mail do nome confirmado?', 'Marcar verificação (lead)', 1);
chain('Salvar contato verificado', 'Marcar verificação (lead)', 'Pausa entre verificações', 'Loop verificação');
chain('Fim da verificação', 'Buscar fila com e-mail', 'Buscar fila fallback', 'Montar fila de envio', 'Loop leads');

link('Loop leads', 'Status envios (lead)', 1);
chain('Status envios (lead)', 'Checar limite (lead)', 'Cabe no limite?');
link('Cabe no limite?', 'Pedido IA - e-mail', 0); link('Cabe no limite?', 'Loop leads', 1);
chain('Pedido IA - e-mail', 'Teto do fallback?');
link('Teto do fallback?', 'Parar: teto do fallback', 0); link('Teto do fallback?', 'Reservar cota IA (e-mail)', 1);
chain('Reservar cota IA (e-mail)', 'Cota IA ok? (e-mail)');
link('Cota IA ok? (e-mail)', 'OpenRouter - gerar e-mail', 0); link('Cota IA ok? (e-mail)', 'Parar: cota IA esgotada', 1);
chain('OpenRouter - gerar e-mail', 'Validar resposta IA - e-mail', 'JSON válido? (e-mail)');
link('JSON válido? (e-mail)', 'E-mail já confirmado?', 0); link('JSON válido? (e-mail)', 'Ainda tem tentativa? (e-mail)', 1);
link('Ainda tem tentativa? (e-mail)', 'Pausa retry (e-mail)', 0); link('Ainda tem tentativa? (e-mail)', 'Revisão manual (e-mail)', 1);
chain('Pausa retry (e-mail)', 'Preparar retry - e-mail', 'Pedido IA - e-mail');
link('E-mail já confirmado?', 'E-mail definido', 0); link('E-mail já confirmado?', 'Há candidatos novos?', 1);
link('Há candidatos novos?', 'Separar candidatos', 0); link('Há candidatos novos?', 'Descartar lead', 1);
chain('Separar candidatos', 'Reacher - candidatos da IA', 'Escolher melhor e-mail', 'Tem e-mail válido?');
link('Tem e-mail válido?', 'E-mail definido', 0); link('Tem e-mail válido?', 'Descartar lead', 1);
chain('E-mail definido', 'Checar bloqueio LGPD', 'Montar e-mail final', 'Bloqueado?');
link('Bloqueado?', 'Descartar lead', 0); link('Bloqueado?', 'Dry-run?', 1);
link('Dry-run?', 'Dry-run: não envia', 0); link('Dry-run?', 'Upsert contato', 1); link('Dry-run: não envia', 'Loop leads');
chain('Upsert contato', 'Enviar e-mail (SMTP)', 'Resultado envio', 'Saída (B)');
link('Revisão manual (e-mail)', 'Saída (B)'); link('Descartar lead', 'Saída (B)');
cauda('(B)', 'Saída (B)', 9, 'Loop leads', 'Houve envio? (B)');
link('Houve envio? (B)', 'Espaçar envios', 0); link('Houve envio? (B)', 'Loop leads', 1); link('Espaçar envios', 'Loop leads');

// ====================== C. RESPOSTAS (passos 6-8) ======================
add('Gmail IMAP - respostas', 'n8n-nodes-base.emailReadImap', 2.2, {
  mailbox: 'INBOX', postProcessAction: 'nothing', format: 'resolved', downloadAttachments: false,
  options: { customEmailConfig: '["UNSEEN"]', trackLastMessageId: true },
}, [0, 12], { credentials: CRED.imap });
loop('Loop respostas', [1, 12]);
code('Extrair resposta', 'c_extrair_resposta.js', [2, 12]);
iff('É resposta do agente?', '$json.ignorar === false', [3, 12]);
supa('Buscar envio original', [4, 12], { path: '/prospeccao_envios', query: {
  select: '*,lead:prospeccao_leads(*),contato:prospeccao_contatos(*)',
  message_id: `={{ 'in.(' + $json.ids.map(i => '"' + i + '"').join(',') + ')' }}`,
  order: 'enviado_em.desc', limit: '1' } });
code('Contexto da resposta', 'c_contexto.js', [5, 12]);
iff('Ignorar? (C)', `$json.acao === 'ignorar'`, [6, 12]);
// Robson 2.0 (Fase 1): toda resposta casada com um envio é gravada bruta em prospeccao_respostas antes de qualquer ação.
// Nunca bloqueia o fluxo: 3 tentativas e segue mesmo com erro. acao_v1 começa 'pendente' e é fechada em "Registrar ação v1".
const CTX = "$('Contexto da resposta').first().json";
supa('Gravar resposta bruta', [6.5, 11], { method: 'POST', path: '/prospeccao_respostas?on_conflict=message_id', soft: true, retry: true,
  prefer: 'resolution=ignore-duplicates,return=minimal',
  body: `={{ JSON.stringify({ message_id: ${CTX}.resposta.message_id, in_reply_to: ${CTX}.resposta.in_reply_to, references_raw: ${CTX}.resposta.references_raw,
    remetente: ${CTX}.resposta.from, assunto: ${CTX}.resposta.assunto, corpo_texto: ${CTX}.resposta.texto, recebido_em: ${CTX}.resposta.recebido_em,
    envio_id: ${CTX}.envio.id, lead_id: ${CTX}.lead.id, teste: !!${CTX}.envio.teste, acao_v1: ${CTX}.acao === 'optout' ? 'optout' : 'pendente' }) }}` });
supa('Registrar resposta no envio', [7, 12], { method: 'PATCH', path: `/prospeccao_envios?id=eq.{{ ${CTX}.envio.id }}`,
  body: `={{ JSON.stringify(${CTX}.resposta_patch) }}` });
iff('É descadastro?', `$('Contexto da resposta').first().json.acao === 'optout'`, [8, 12]);
// respostas.motor = "v2": o v1 só grava (o módulo prspRespostas02 decide). SAIR continua imediato no v1 (LGPD).
iff('Motor v1?', `${MOTOR_V1} === true`, [8.5, 13]);
supa('Motor v2: só registra', [9, 13.5], { method: 'PATCH', path: '/prospeccao_respostas', soft: true, retry: true, prefer: 'return=minimal',
  query: { message_id: `={{ 'eq.' + ${CTX}.resposta.message_id }}` }, body: `={{ JSON.stringify({ acao_v1: 'v2_registrado' }) }}` });
code('Pedido IA - qualificação', 'c_pedido_ia.js', [9, 12]);
reservarIA('Reservar cota IA (resposta)', [10, 12]);
iff('Cota IA ok? (resposta)', '$json.ok === true', [11, 12]);
openrouter('OpenRouter - qualificar', 'Pedido IA - qualificação', [12, 12]);
code('Validar resposta IA - qualificação', 'c_validar_ia.js', [13, 12]);
iff('JSON válido? (resposta)', '$json.ok === true', [14, 12]);
iff('Ainda tem tentativa? (resposta)', `$json.tentativa < ${CONFIG.maxTentativasIA}`, [14, 14]);
wait('Pausa retry (resposta)', 15, [13, 15]);
code('Preparar retry - qualificação', '_retry.js', [11, 15]);
code('Revisão manual (resposta)', 'c_revisao.js', [15, 16]);
supa('Salvar classificação', [15, 12], { method: 'PATCH', path: `/prospeccao_envios?id=eq.{{ $('Contexto da resposta').first().json.envio.id }}`,
  body: `={{ JSON.stringify({ classificacao_ia: Object.assign({}, $('Contexto da resposta').first().json.envio.classificacao_ia, { qualificacao: $json.q, modelo: $json.modelo }) }) }}` });
code('Decidir próxima ação', 'c_decidir.js', [16, 12]);
iff('Agendar?', `$json.acao === 'agendar'`, [17, 12]);
iff('Propor?', `$json.acao === 'propor'`, [17, 14]);
iff('Revisão? (C)', `$json.acao === 'revisao'`, [17, 16]);
code('Dados bloqueio', 'c_bloqueio.js', [18, 18]);
supa('Bloquear contatos', [19, 18], { method: 'POST', path: '/prospeccao_contatos?on_conflict=email',
  prefer: 'resolution=merge-duplicates,return=representation', body: '={{ JSON.stringify($json.rows) }}' });
const freeBusy = (name, pos, minExpr, maxExpr) => http(name, pos, {
  method: 'POST', url: 'https://www.googleapis.com/calendar/v3/freeBusy', cred: 'gcal', credType: 'googleCalendarOAuth2Api', soft: true,
  body: `={{ JSON.stringify({ timeMin: ${minExpr}, timeMax: ${maxExpr}, timeZone: '${CONFIG.agenda.fuso}', items: [{ id: 'primary' }] }) }}` });
freeBusy('Calendar - checar horário', [18, 12], `$json.slot.inicio`, `$json.slot.fim`);
code('Horário ainda livre?', 'c_slot_livre.js', [19, 12]);
iff('Livre?', '$json.livre === true', [20, 12]);
code('Montar evento', 'c_evento_body.js', [21, 12]);
http('Calendar - criar evento', [22, 12], {
  method: 'POST', url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
  query: { sendUpdates: 'all', conferenceDataVersion: '1' }, cred: 'gcal', credType: 'googleCalendarOAuth2Api', soft: true,
  body: '={{ JSON.stringify($json.body) }}' });
code('Montar confirmação', 'c_confirmacao.js', [23, 12]);
iff('Evento criado?', '$json.evento_ok === true', [24, 12]);
smtp('Enviar confirmação (SMTP)', 'Montar confirmação', [25, 12]);
code('Resultado confirmação', 'c_resultado_resposta.js', [26, 12], `const MODO = 'confirmacao';`);
freeBusy('Calendar - freeBusy (proposta)', [18, 14], 'new Date().toISOString()', `new Date(Date.now() + ${CONFIG.agenda.diasAFrente + 1} * 864e5).toISOString()`);
code('Montar proposta de horários', 'c_horarios.js', [19, 14]);
iff('Calendar ok? (proposta)', '$json.calendario_falhou !== true', [19.5, 15]);
smtp('Enviar proposta (SMTP)', 'Montar proposta de horários', [20, 14]);
code('Resultado proposta', 'c_resultado_resposta.js', [21, 14], `const MODO = 'proposta';`);
code('Saída (C)', '_saida.js', [0, 20], `const ORIGEM_FALLBACK = 'Dados bloqueio';`);

chain('Gmail IMAP - respostas', 'Loop respostas');
link('Resposta simulada', 'Loop respostas');
link('Loop respostas', 'Extrair resposta', 1);
chain('Extrair resposta', 'É resposta do agente?');
link('É resposta do agente?', 'Buscar envio original', 0); link('É resposta do agente?', 'Loop respostas', 1);
chain('Buscar envio original', 'Contexto da resposta', 'Ignorar? (C)');
link('Ignorar? (C)', 'Loop respostas', 0); link('Ignorar? (C)', 'Gravar resposta bruta', 1);
chain('Gravar resposta bruta', 'Registrar resposta no envio');
chain('Registrar resposta no envio', 'É descadastro?');
link('É descadastro?', 'Dados bloqueio', 0); link('É descadastro?', 'Motor v1?', 1);
link('Motor v1?', 'Pedido IA - qualificação', 0); link('Motor v1?', 'Motor v2: só registra', 1); link('Motor v2: só registra', 'Loop respostas');
chain('Pedido IA - qualificação', 'Reservar cota IA (resposta)', 'Cota IA ok? (resposta)');
link('Cota IA ok? (resposta)', 'OpenRouter - qualificar', 0); link('Cota IA ok? (resposta)', 'Revisão manual (resposta)', 1);
chain('OpenRouter - qualificar', 'Validar resposta IA - qualificação', 'JSON válido? (resposta)');
link('JSON válido? (resposta)', 'Salvar classificação', 0); link('JSON válido? (resposta)', 'Ainda tem tentativa? (resposta)', 1);
link('Ainda tem tentativa? (resposta)', 'Pausa retry (resposta)', 0); link('Ainda tem tentativa? (resposta)', 'Revisão manual (resposta)', 1);
chain('Pausa retry (resposta)', 'Preparar retry - qualificação', 'Pedido IA - qualificação');
chain('Salvar classificação', 'Decidir próxima ação', 'Agendar?');
link('Agendar?', 'Calendar - checar horário', 0); link('Agendar?', 'Propor?', 1);
link('Propor?', 'Calendar - freeBusy (proposta)', 0); link('Propor?', 'Revisão? (C)', 1);
link('Revisão? (C)', 'Revisão manual (resposta)', 0); link('Revisão? (C)', 'Dados bloqueio', 1);
chain('Calendar - checar horário', 'Horário ainda livre?', 'Livre?');
link('Livre?', 'Montar evento', 0); link('Livre?', 'Calendar - freeBusy (proposta)', 1);
chain('Montar evento', 'Calendar - criar evento', 'Montar confirmação', 'Evento criado?');
link('Evento criado?', 'Enviar confirmação (SMTP)', 0); link('Evento criado?', 'Revisão manual (resposta)', 1);
chain('Enviar confirmação (SMTP)', 'Resultado confirmação', 'Saída (C)');
chain('Calendar - freeBusy (proposta)', 'Montar proposta de horários', 'Calendar ok? (proposta)');
link('Calendar ok? (proposta)', 'Enviar proposta (SMTP)', 0); link('Calendar ok? (proposta)', 'Revisão manual (resposta)', 1);
chain('Enviar proposta (SMTP)', 'Resultado proposta', 'Saída (C)');
chain('Dados bloqueio', 'Bloquear contatos', 'Saída (C)');
link('Revisão manual (resposta)', 'Saída (C)');
supa('Registrar ação v1', [0.5, 21], { method: 'PATCH', path: '/prospeccao_respostas', soft: true, retry: true, prefer: 'return=minimal',
  query: { message_id: `={{ 'eq.' + ${CTX}.resposta.message_id }}` },
  body: `={{ JSON.stringify({ acao_v1: $('Saída (C)').first().json.acao_v1 || 'desconhecida' }) }}` });
// Resposta de lead em revisão manual (qualquer motivo) → além do card, e-mail curto ao João com o link do card.
// Só no ramo C: revisão de texto da IA no envio frio (ramo B) continua só no Trello.
iff('Avisar João? (C)', `$('Saída (C)').first().json.acao_v1 === 'revisao_manual'`, [8, 21]);
code('Montar aviso de revisão', 'c_aviso_revisao.js', [9, 21]);
smtp('Enviar aviso de revisão (SMTP)', 'Montar aviso de revisão', [10, 21]);
cauda('(C)', 'Saída (C)', 20, 'Loop respostas', 'Loop respostas', 'Registrar ação v1', 'Avisar João? (C)');
link('Avisar João? (C)', 'Montar aviso de revisão', 0); link('Avisar João? (C)', 'Loop respostas', 1);
chain('Montar aviso de revisão', 'Enviar aviso de revisão (SMTP)', 'Loop respostas');

// ---------- saída ----------
const wf = {
  id: 'prspAgenteProsp1',
  name: 'NOVAX - Agente de Prospecção',
  // Robson roda em produção ao lado da Claudia (gatilhos, credenciais e tabelas separados).
  active: true,
  nodes,
  connections,
  pinData: {},
  meta: { buildId: BUILD_ID },
  settings: { executionOrder: 'v1', timezone: CONFIG.agenda.fuso, saveManualExecutions: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', callerPolicy: 'workflowsFromSameOwner' },
};
mkdirSync(join(DIR, 'dist'), { recursive: true });
writeFileSync(join(DIR, 'dist', 'novax-agente-prospeccao.json'), JSON.stringify(wf, null, 2));
console.log(`build ${BUILD_ID} · ok: ${nodes.length} nós, ${Object.values(connections).reduce((a, c) => a + c.main.flat().length, 0)} conexões`);

// ====================== WATCHDOG (workflow separado, prspWatchdog01) ======================
// Resumo diário 10:15 BRT para o João (CONFIG.alertaDestino). Só GET no Supabase + 1 e-mail; não toca o Robson.
nodes.length = 0;
for (const k of Object.keys(connections)) delete connections[k];
const HOJE = "$('Janela de hoje').first().json";
add('Teste manual (watchdog)', 'n8n-nodes-base.manualTrigger', 1, {}, [0, 1]);
schedule('Diário - Watchdog', '15 10 * * 1-5', [0, 0]);
code('Janela de hoje', 'w_janela.js', [1, 0]);
supa('W: status envio', [2, 0], { path: '/prospeccao_status_envio?select=*' });
supa('W: envios hoje', [3, 0], { path: `/prospeccao_envios?select=tipo,status,teste&enviado_em=gte.{{ ${HOJE}.inicio }}` });
supa('W: verificados hoje', [4, 0], { path: `/prospeccao_leads?select=id&verificacao_codigo_em=gte.{{ ${HOJE}.inicio }}` });
supa('W: contatos hoje', [5, 0], { path: `/prospeccao_contatos?select=reacher_status&verificado_em=gte.{{ ${HOJE}.inicio }}` });
supa('W: uso API hoje', [6, 0], { path: `/prospeccao_uso_api?select=servico,chamadas&periodo=eq.{{ ${HOJE}.dia }}` });
supa('W: respostas hoje', [7, 0], { path: `/prospeccao_envios?select=id&resposta_recebida_em=gte.{{ ${HOJE}.inicio }}` });
supa('W: fila sem verificação', [8, 0], { path: '/prospeccao_leads?select=id&status=eq.novo&verificacao_codigo_em=is.null' });
supa('W: contatos pendentes', [9, 0], { path: '/prospeccao_leads?select=id,contatos:prospeccao_contatos!inner(id)&status=eq.novo&contatos.reacher_status=eq.safe&contatos.bloqueado=is.false' });
// Bloco semanal (segundas): view da migration 006. Falha suave: sem a view, o resumo diário sai normalmente.
supa('W: confirmação por nicho', [9.5, 1], { path: '/prospeccao_confirmacao_nicho?select=*&order=captados.desc', soft: true });
code('Montar resumo', 'w_resumo.js', [10, 0]);
smtp('Enviar resumo (SMTP)', 'Montar resumo', [11, 0]);
chain('Diário - Watchdog', 'Janela de hoje', 'W: status envio', 'W: envios hoje', 'W: verificados hoje', 'W: contatos hoje',
  'W: uso API hoje', 'W: respostas hoje', 'W: fila sem verificação', 'W: contatos pendentes', 'W: confirmação por nicho', 'Montar resumo',
  'Enviar resumo (SMTP)');
link('Teste manual (watchdog)', 'Janela de hoje');
// Cada consulta roda UMA vez: sem isso o n8n repete o nó para cada item recebido do anterior e os números se multiplicam.
for (const n of nodes) if (n.type === 'n8n-nodes-base.httpRequest') n.executeOnce = true;
const wd = { ...wf, id: 'prspWatchdog01', name: 'NOVAX - Robson Watchdog', nodes, connections };
writeFileSync(join(DIR, 'dist', 'novax-robson-watchdog.json'), JSON.stringify(wd, null, 2));
console.log(`watchdog ${BUILD_ID} · ok: ${nodes.length} nós, ${Object.values(connections).reduce((a, c) => a + c.main.flat().length, 0)} conexões`);
