// Troca do verificador (26/10): Reacher → Verifalia v2.7. Offline, respostas fictícias da Verifalia, sem rede.
// Uso: node workflow/tests/verificador-verifalia.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const rodar = (file, { input = [], nodes = {}, staticData = {}, execId = '1', pre = '' } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + pre + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: execId }, CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

// Respostas fictícias no formato do n8n com "resposta completa" (statusCode + body).
const job = (id, classification, status = 'Success') => ({ statusCode: 200, body: { overview: { id, status: 'Completed' },
  entries: { data: [{ inputData: 'x', classification, status }] } } });
const PRE = "const VERIFALIA_POST = 'POST'; const VERIFALIA_ENTRADA = 'ENTRADA';";
const verificar = (emails, posts, esperas) => rodar('b_verifalia.js', { pre: PRE,
  input: esperas.map((json) => ({ json })), nodes: { ENTRADA: emails.map((email) => ({ json: { email } })), POST: posts.map((json) => ({ json })) } }).map((i) => i.json);

console.log('Mapeamento das respostas');
{
  const emails = ['Aurora.Ficticia@gmail.com', 'naoexiste.ficticia@hotmail.com', 'risco.ficticio@yahoo.com', 'desconhecido.ficticio@exemplo.com.br', 'todos.ficticio@exemplo.com.br'];
  const posts = [job('j1', 'Deliverable'), job('j2', 'Undeliverable', 'MailboxDoesNotExist'), job('j3', 'Risky', 'MailboxValidationTimeout'),
    job('j4', 'Unknown', 'DnsQueryTimeout'), job('j5', 'Risky', 'ServerIsCatchAll')];
  const r = verificar(emails, posts, posts);
  ok(r[0].is_reachable === 'safe' && r[0].input === 'aurora.ficticia@gmail.com', 'Deliverable → safe (e-mail em minúsculas)');
  ok(r[1].is_reachable === 'invalid', 'Undeliverable → invalid');
  ok(r[2].is_reachable === 'unknown', 'Risky → unknown');
  ok(r[3].is_reachable === 'unknown', 'Unknown → unknown');
  ok(r[4].is_reachable === 'unknown', 'ServerIsCatchAll → unknown');
  ok(r.every((x) => x.semCreditosLote === false && !x.error), 'sem 402: lote não marcado');
  ok(r[0].verifalia.classification === 'Deliverable' && Object.keys(r[0]).sort().join() === 'input,is_reachable,semCreditosLote,verifalia',
     'saída só com input, is_reachable e a classificação (nada de nome, empresa ou cidade)');
  const s = verificar(['corpo.texto@gmail.com'], [{ statusCode: 200, body: JSON.stringify(job('j6', 'Deliverable').body) }], [{}]);
  ok(s[0].is_reachable === 'safe', 'corpo em texto JSON também é lido');
}

console.log('202 + espera (polling)');
{
  const pend = { statusCode: 202, body: { overview: { id: 'j7', status: 'InProgress' } } };
  const a = verificar(['espera.ficticia@gmail.com'], [pend], [job('j7', 'Deliverable')]);
  ok(a[0].is_reachable === 'safe', '202 no POST → vale o GET de espera (Deliverable → safe)');
  const b = verificar(['espera.ficticia@gmail.com'], [pend], [{ statusCode: 202, body: { overview: { id: 'j7', status: 'InProgress' } } }]);
  ok(b[0].error && !b[0].is_reachable, '202 também no GET → inconclusivo (erro, conta no disjuntor)');
  const c = verificar(['espera.ficticia@gmail.com'], [pend], [{ error: { message: 'timeout' } }]);
  ok(/após 202/.test(c[0].error), 'GET com timeout depois de 202 → inconclusivo');
  const d = verificar(['ja.pronto@gmail.com'], [job('j8', 'Undeliverable')], [{ statusCode: 404, body: {} }]);
  ok(d[0].is_reachable === 'invalid', '200 no POST → o GET de espera é ignorado');
}

console.log('402 (créditos do dia acabaram) e erros');
{
  const r = verificar(['a.ficticio@gmail.com', 'b.ficticio@gmail.com'], [job('j9', 'Deliverable'), { statusCode: 402, body: {} }], [job('j9', 'Deliverable'), { statusCode: 404 }]);
  ok(r[1].sem_creditos === true && r[1].error, '402 → sem_creditos');
  ok(r.every((x) => x.semCreditosLote === true), '402 marca o lote inteiro (o IF manda tudo para o mesmo lado)');
  const e = verificar(['c.ficticio@gmail.com', 'd.ficticio@gmail.com'], [{ error: { message: 'ECONNRESET' } }, { statusCode: 500, body: {} }], [{}, {}]);
  ok(e.every((x) => x.error && !x.is_reachable && !x.sem_creditos), 'erro de rede ou 500 → inconclusivo, sem marcar créditos');
}

console.log('Fase 1 (variações) e disjuntor');
{
  const lead = { id: 'L1', nome: 'Clínica Aurora Fictícia', cidade: 'Vila Exemplo' };
  const fase1 = (itens, sd, exec = 'E1') => rodar('b_resultado_verificacao.js', { input: itens.map((json) => ({ json })), staticData: sd, execId: exec,
    nodes: { 'Loop verificação': [{ json: lead }] } })[0].json;
  const sd = {};
  const safe = fase1(verificar(['auroraficticia@gmail.com', 'contato.auroraficticia@gmail.com'], [job('a', 'Undeliverable'), job('b', 'Deliverable')], [{}, {}]), sd);
  ok(safe.safe && safe.email === 'contato.auroraficticia@gmail.com' && !safe.incompleto && !safe.semCreditos, 'Deliverable numa variação → contato confirmado');
  const inval = fase1(verificar(['auroraficticia@gmail.com'], [job('c', 'Undeliverable')], [{}]), sd);
  ok(!inval.safe && !inval.incompleto && !inval.disjuntor, 'só Undeliverable → lead verificado, sem contar no disjuntor');
  let ult;
  for (let i = 0; i < CONFIG.reacherFalhasSeguidasMax; i++) ult = fase1(verificar(['x@exemplo.com.br'], [job('r' + i, 'Risky', 'MailboxValidationTimeout')], [{}]), sd);
  ok(CONFIG.reacherFalhasSeguidasMax === 3 && ult.disjuntor === true && ult.falhasSeguidas === 3, 'disjuntor continua: 3 inconclusivos seguidos (Risky/Unknown)');
  const sem = fase1(verificar(['y@gmail.com'], [{ statusCode: 402 }], [{}]), {}, 'E2');
  ok(sem.semCreditos === true && !sem.safe, '402 nas variações → semCreditos (vai para "Sem orçamento Reacher")');
  const sd2 = {};
  rodar('b_sem_orcamento_reacher.js', { input: [{ json: sem }], staticData: sd2, execId: 'E2' });
  ok(sd2.reacherSemOrcamentoExec === 'E2', '"Sem orçamento Reacher" marca a execução: sem fallback hoje');
}

console.log('Fase 2 (candidatos da IA)');
{
  const v = { lead: { id: 'L2' }, assunto: 'Assunto fictício', corpo: 'Corpo fictício' };
  const esc = (itens) => rodar('b_escolher_email.js', { input: itens.map((json) => ({ json })), nodes: { 'Validar resposta IA - e-mail': [{ json: v }] } })[0].json;
  const a = esc(verificar(['um.ficticio@hotmail.com', 'dois.ficticio@gmail.com'], [job('k1', 'Risky'), job('k2', 'Deliverable')], [{}, {}]));
  ok(a.tem_email && a.email === 'dois.ficticio@gmail.com' && a.reacher.is_reachable === 'safe', 'escolhe o Deliverable (formato do Reacher mantido)');
  const b = esc(verificar(['um.ficticio@hotmail.com'], [job('k3', 'Undeliverable')], [{}]));
  ok(!b.tem_email && b.verificados[0].status === 'invalid', 'nenhum Deliverable → sem e-mail (descarte)');
}

console.log('Hotmail/Outlook/Yahoo reativados');
{
  const lib = new Function('CONFIG', LIB + '; return { emailPossivel };')(CONFIG);
  ok(['a.ficticio@hotmail.com', 'a.ficticio@outlook.com', 'a.ficticio@yahoo.com.br', 'a.ficticio@live.com'].every(lib.emailPossivel), 'emailPossivel aceita Hotmail/Outlook/Yahoo/Live');
  ok(!lib.emailPossivel('abc@gmail.com') && !lib.emailPossivel('a'.repeat(31) + '@gmail.com'), 'Gmail impossível (<6 ou >30) continua recusado');
}

console.log('Workflow gerado');
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((c) => c.node);
  const txt = JSON.stringify(w);
  ok(!txt.includes('novax-prospeccao-reacher') && !txt.includes('check_email') && !('reacherUrl' in CONFIG), 'nenhum nó usa mais o Reacher (reacherUrl removido)');
  const vf = w.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest' && String(n.parameters.url).includes('api.verifalia.com/v2.7/email-validations'));
  ok(vf.length === 4, `4 nós HTTP da Verifalia (2 POST + 2 GET de espera): ${vf.map((n) => n.name).join(', ')}`);
  ok(vf.every((n) => n.credentials?.httpBasicAuth?.id === 'prspVerifalia001' && n.parameters.genericAuthType === 'httpBasicAuth'
     && n.parameters.authentication === 'genericCredentialType'), 'todos com a credencial httpBasicAuth prspVerifalia001');
  ok(vf.every((n) => n.parameters.options.response?.response?.fullResponse === true && n.parameters.options.response.response.neverError === true
     && n.onError === 'continueRegularOutput' && n.parameters.options.timeout > CONFIG.verifaliaEsperaMs), 'resposta completa (statusCode), sem quebrar o fluxo, timeout > waitTime');
  const posts = vf.filter((n) => n.parameters.method === 'POST');
  ok(posts.length === 2 && posts.every((n) => /\?waitTime=30000$/.test(n.parameters.url)), 'POST com waitTime=30000');
  ok(posts.every((n) => n.parameters.jsonBody === "={{ JSON.stringify({ entries: [{ inputData: $json.email }], quality: 'Standard', retention: '0:5:0' }) }}"),
     'corpo: só o endereço (inputData), quality Standard, retention 0:5:0');
  ok(vf.filter((n) => n.parameters.method === 'GET').every((n) => /email-validations\/\{\{ .*overview\.id.*\}\}\?waitTime=30000$/.test(n.parameters.url)),
     'GET de espera em /email-validations/{id}?waitTime=30000');
  ok(posts.every((n) => !n.parameters.options.batching || n.parameters.options.batching.batch.batchInterval < 6000), 'sem o espaçamento de 6 s do Reacher');
  ok(saidas('Variações reservadas')[0] === 'Verifalia - variações do nome' && saidas('Verifalia - variações do nome')[0] === 'Verifalia - aguardar (variações do nome)'
     && saidas('Verifalia - aguardar (variações do nome)')[0] === 'Verifalia → resultado (variações do nome)'
     && saidas('Verifalia → resultado (variações do nome)')[0] === 'Resultado verificação (código)', 'variações: reserva → POST → espera → resultado → fase 1');
  ok(saidas('Resultado verificação (código)')[0] === 'Verifalia sem créditos? (variações)' && saidas('Verifalia sem créditos? (variações)', 0)[0] === 'Sem orçamento Reacher'
     && saidas('Verifalia sem créditos? (variações)', 1)[0] === 'Reacher travou?', 'variações: 402 → "Sem orçamento Reacher"; senão segue para o disjuntor');
  ok(saidas('Separar candidatos')[0] === 'Verifalia - candidatos da IA' && saidas('Verifalia → resultado (candidatos da IA)')[0] === 'Verifalia sem créditos? (candidatos)'
     && saidas('Verifalia sem créditos? (candidatos)', 0)[0] === 'Parar: orçamento do Reacher' && saidas('Verifalia sem créditos? (candidatos)', 1)[0] === 'Escolher melhor e-mail',
     'candidatos: 402 → "Parar: orçamento do Reacher" (sem fallback, excedente amanhã)');
  ok(/p_origem: 'verifalia:candidatos'/.test(no('Reservar Reacher (candidatos)').parameters.jsonBody)
     && /p_origem: 'verifalia:variacoes'/.test(no('Reservar Reacher (variações)').parameters.jsonBody), 'orçamento 007 com origem verifalia:*');
  ok(/robson:disjuntor/.test(no('Registrar disjuntor').parameters.jsonBody), 'disjuntor segue registrado como robson:disjuntor (o watchdog em produção alerta por essa origem)');
  ok(/const VERIFALIA_POST = "Verifalia - candidatos da IA"; const VERIFALIA_ENTRADA = "Separar candidatos";/.test(no('Verifalia → resultado (candidatos da IA)').parameters.jsCode),
     'resultado dos candidatos lê o POST e a entrada certos');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
