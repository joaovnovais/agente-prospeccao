// Testes offline das correções de 06/10 (nomes FICTÍCIOS: o repositório é público). Uso: node workflow/tests/correcoes-2026-10-06.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { emailIdentificaEmpresa, checarFatos, ASSUNTO_SITE_EXISTE_RE, janelasHash, fnv64, norm };')(CONFIG);
// Executa um Code node como o n8n: corpo de função com $input, $, $getWorkflowStaticData, $execution.
const rodar = (file, { input = [], nodes = {}, staticData = {}, execId = '1', config = CONFIG } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: execId }, config);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Disjuntor (b_resultado_verificacao.js)');
{
  const lead = { json: { id: 'L', nome: 'Exemplo' } };
  const rq = (st) => ({ json: st === 'erro' ? { error: { message: 'timeout' } } : { input: 'exemplo@gmail.com', is_reachable: st } });
  const passo = (sd, ex, sts) => rodar('b_resultado_verificacao.js', { input: sts.map(rq), nodes: { 'Loop verificação': [lead] }, staticData: sd, execId: ex })[0].json;
  const sd = {};
  const a = passo(sd, 'A', ['unknown']);
  ok(a.incompleto && !a.disjuntor && a.falhasSeguidas === 1, 'falha isolada não abre (falhasSeguidas=1)');
  ok('disjuntor' in a && 'falhasSeguidas' in a, 'saída traz disjuntor e falhasSeguidas');
  passo(sd, 'A', ['erro']); const c = passo(sd, 'A', ['unknown']);
  ok(c.disjuntor && c.falhasSeguidas === CONFIG.reacherFalhasSeguidasMax, `${CONFIG.reacherFalhasSeguidasMax} inconclusivas seguidas abrem`);
  const sd2 = {}; passo(sd2, 'B', ['unknown']); passo(sd2, 'B', ['unknown']); const z = passo(sd2, 'B', ['invalid']);
  ok(!z.incompleto && z.falhasSeguidas === 0, 'resultado conclusivo zera o contador');
  passo(sd2, 'B', ['unknown']); passo(sd2, 'B', ['unknown']); const n = passo(sd2, 'C', ['unknown']);
  ok(n.falhasSeguidas === 1 && !n.disjuntor, 'nova execução zera o contador');
  ok(passo({}, 'D', ['safe', 'unknown']).safe === true, 'safe prevalece sobre unknown no mesmo lead');
}

console.log('Ramp-up (b_limite_dia.js): 1º envio real 29/09 09:31:52 BRT');
{
  const primeiro = '2026-09-29T12:31:52.982Z';
  const em = (iso, totalHoje = 0) => {
    const real = Date.now; Date.now = () => new Date(iso).getTime();
    try { return rodar('b_limite_dia.js', { input: [{ json: { primeiro_envio: primeiro, total_hoje: totalHoje, total_hoje_teste: 0 } }] })[0]?.json; }
    finally { Date.now = real; }
  };
  ok(em('2026-09-29T12:35:00Z').limite === 5, '29/09: 5/dia');
  ok(em('2026-10-06T12:30:00Z').limite === 5, '06/10 09:30 BRT (antes de 09:31:52): ainda 5/dia — explica os 5 envios de 06/10');
  ok(em('2026-10-06T12:32:00Z').limite === 10, '06/10 09:32 BRT: 10/dia (a semana vira no horário exato do 1º envio)');
  ok(em('2026-10-07T12:30:00Z').limite === 10, '07/10 09:30 BRT: 10/dia');
  ok(em('2026-10-13T12:30:00Z').limite === 10, '13/10 09:30 BRT: ainda 10/dia');
  ok(em('2026-10-14T12:30:00Z').limite === 15, '14/10 09:30 BRT: 15/dia');
  ok(em('2026-10-07T12:30:00Z', 10) === undefined, 'limite já atingido no dia → nenhuma busca de leads');
  const lote = em('2026-10-07T12:30:00Z', 4);
  ok(lote.restante === 6 && lote.lote === Math.min(18, CONFIG.limiteDiarioOpenRouter), 'restante = limite − enviados; lote = 3× restante (teto da cota de IA)');
}

console.log('Homônimo (emailIdentificaEmpresa)');
ok(!lib.emailIdentificaEmpresa('silvaadvocacia@gmail.com', 'Silva Advocacia', 'Cidade Exemplo'), 'sobrenome comum sozinho reprova (gmail)');
ok(!lib.emailIdentificaEmpresa('contato.pereiraadvocacia@gmail.com', 'Pereira Advocacia', 'Cidade Exemplo'), 'sobrenome comum sozinho reprova (contato.)');
ok(lib.emailIdentificaEmpresa('quintavelleadvocacia@gmail.com', 'Quintavelle Advocacia', 'Cidade Exemplo'), 'nome raro de 8+ letras aprova');
ok(lib.emailIdentificaEmpresa('silvatravessoadvogados@gmail.com', 'Silva & Travesso Advogados', 'Cidade Exemplo'), '2 palavras distintivas aprova (mesmo com sobrenome comum)');
ok(!lib.emailIdentificaEmpresa('itapuaadvocacia@gmail.com', 'Advocacia Itapuã', 'Itapuã'), 'cidade não conta como palavra distintiva');
ok(!lib.emailIdentificaEmpresa('consultoriajuridica@gmail.com', 'Consultoria Jurídica e Advocacia', 'Cidade Exemplo'), 'termos jurídicos não contam');
ok(lib.emailIdentificaEmpresa('silva@silvaadvocacia.com.br', 'Silva Advocacia', 'Cidade Exemplo'), 'domínio próprio da empresa não é afetado pela regra de sobrenome');
ok(lib.emailIdentificaEmpresa('zebodonto@gmail.com', 'Zeb Odonto Cidade', 'Cidade'), 'marca curta e rara continua aprovada (regressão: envios legítimos)');

console.log('Exclusão por hash (janelasHash + config.exclusoes)');
ok(!JSON.stringify(CONFIG.exclusoes).match(/[a-z]{3,} [a-z]{3,}/), 'config.exclusoes não contém nomes legíveis');
ok(CONFIG.exclusoes.length >= 7 && CONFIG.exclusoes.every((e) => Object.values(e).flat().every((h) => /^[0-9a-f]{16}$/.test(h))), 'todas as regras são hashes fnv64');
{
  const regra = { nome: [lib.fnv64('alfa beta')], nomeOuEndereco: [lib.fnv64('gama')] };
  const casa = (nome, end) => regra.nome.every((h) => lib.janelasHash(nome, 4).has(h)) && regra.nomeOuEndereco.every((h) => lib.janelasHash(nome + ' ' + end, 4).has(h));
  ok(casa('Clínica Alfa Beta', 'Rua X, Gama'), 'frase contígua no nome + termo no endereço → exclui');
  ok(!casa('Alfa Clínica Beta', 'Gama'), 'tokens não contíguos → não exclui (igual à regra antiga)');
  ok(!casa('Alfa Beta', 'Rua Delta'), 'sem o termo de endereço → não exclui');
  ok(lib.janelasHash('Ordem dos Advogados do Brasil', CONFIG.exclusoesJanelaMax).has(lib.fnv64('ordem dos advogados'))
    && CONFIG.exclusoes.some((e) => (e.nome || []).includes(lib.fnv64('ordem dos advogados'))), 'OAB (entidade pública) segue excluída');
}

console.log('Validador de texto (06/10)');
const L = { nome: 'Exemplo Odonto', cidade: 'Cidade', rating: 4.7, total_avaliacoes: 40 };
ok(lib.checarFatos('tem uma boa avaliação no Google', L).length > 0, '"boa avaliação" (singular) reprova');
ok(lib.checarFatos('é bem avaliada pelos clientes', L).length > 0, '"bem avaliada" reprova');
ok(lib.checarFatos('tem ótima reputação', L).length > 0, '"reputação" reprova');
ok(lib.checarFatos('tem nota 4,7 com 40 avaliações no Google', L).length === 0, 'nota e quantidade dos dados aprovam');
ok(lib.ASSUNTO_SITE_EXISTE_RE.test('Exemplo Odonto ganha site profissional'), 'assunto "ganha site" reprova');
ok(lib.ASSUNTO_SITE_EXISTE_RE.test('Exemplo Odonto já tem site novo'), 'assunto "já tem site" reprova');
ok(!lib.ASSUNTO_SITE_EXISTE_RE.test('Exemplo Odonto pode aparecer com site no Google'), 'assunto "pode aparecer com site" aprova');
ok(!lib.ASSUNTO_SITE_EXISTE_RE.test('Exemplo Odonto não tem site no Google'), 'assunto "não tem site" aprova');
ok(!lib.ASSUNTO_SITE_EXISTE_RE.test('Site para a Exemplo Odonto em Cidade'), 'assunto "Site para…" aprova');
const P = { ...L, rating: 5, total_avaliacoes: 4 };
ok(lib.checarFatos('tem nota 5,0 com 4 avaliações', P).some((e) => /mínimo/.test(e)), 'poucas avaliações: citar nota reprova');
ok(lib.checarFatos('a Exemplo Odonto em Cidade não tem site vinculado', P).length === 0, 'poucas avaliações: sem citar nota aprova');
ok(lib.checarFatos('tem 40 avaliações e nota 5, mas não', { ...L, rating: 5 }).some((e) => /decimal/.test(e)), '"nota 5," (vírgula de pontuação) reprova por falta de casa decimal');
ok(lib.checarFatos('Gostariamos de agendar.', L).length > 0 && lib.checarFatos('não há site vincado', L).length > 0, 'regras antigas seguem valendo');

console.log('Watchdog (w_resumo.js)');
{
  const janela = { dia: '2026-10-07', inicio: '2026-10-07T03:00:00.000Z', diaUtil: true };
  const cen = (dados) => rodar('w_resumo.js', { nodes: { 'Janela de hoje': [{ json: janela }], 'W: status envio': [{ json: { primeiro_envio: '2026-09-29T12:31:52.982Z' } }],
    'W: envios hoje': (dados.envios || [{}]).map((json) => ({ json })), 'W: verificados hoje': (dados.verif || [{}]).map((json) => ({ json })),
    'W: contatos hoje': [{ json: {} }], 'W: uso API hoje': [{ json: { servico: 'openrouter', chamadas: dados.ia || 0 } }],
    'W: respostas hoje': [{ json: {} }], 'W: fila sem verificação': [{ json: { id: 'x' } }], 'W: contatos pendentes': [{ json: {} }] } })[0].json;
  const zero = cen({ verif: [{ id: 1 }] });
  ok(zero.assunto.startsWith('[ALERTA Robson]') && zero.assunto.includes('0 e-mails hoje'), '0 envios em dia útil → [ALERTA Robson] 0 e-mails hoje');
  const cinco = cen({ envios: Array.from({ length: 5 }, () => ({ tipo: 'prospeccao', status: 'enviado', teste: false })), verif: [{ id: 1 }], ia: 7 });
  ok(cinco.assunto === '[Robson] 5 e-mails hoje' && cinco.numeros.limite === 10, '5 envios → [Robson] 5 e-mails hoje, limite 10 em 07/10');
  const vazio = cen({});
  ok(vazio.assunto.includes('0 e-mails hoje') && vazio.assunto.includes('0 leads verificados'), 'banco sem dados → alerta de 0 envios e 0 verificados');
  ok(cinco.destino === CONFIG.alertaDestino && !!CONFIG.alertaDestino, 'destinatário vem só de config.alertaDestino');
  // Regressão da 1ª prova (06/10 19:28): sem executeOnce o n8n repetia cada consulta por item recebido (números multiplicados).
  const wd = JSON.parse(readFileSync(`${R}/dist/novax-robson-watchdog.json`, 'utf8'));
  const https = wd.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  // 13/10: 9ª consulta = bloco semanal (taxa de e-mail confirmado por nicho).
  ok(https.length === 9 && https.every((n) => n.executeOnce === true && n.parameters.method === 'GET'), 'watchdog: 9 consultas GET, cada uma com executeOnce');
  ok(wd.id === 'prspWatchdog01' && wd.id !== '6NJ7fIsgaBsWh1iX', 'watchdog tem ID próprio');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
