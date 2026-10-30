// Ajuste de rendimento da Verifalia (28/10): variações em ordem de acerto, uma por vez, parando no 1º e-mail confirmado;
// fila de verificação priorizada pela taxa do nicho. Dados fictícios. Uso: node workflow/tests/rendimento-verifalia.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const rodar = (file, { input = [], nodes = {}, staticData = {}, execId = '1', cfg = CONFIG } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: execId }, cfg);
const libCom = (cfg) => new Function('CONFIG', LIB + '; return { variantesEmail };')(cfg);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Ordem das variações');
{
  const { variantesEmail } = libCom(CONFIG);
  const vs = variantesEmail('Casa da Aurora Fictícia', 'Vila Exemplo');
  ok(JSON.stringify(vs) === JSON.stringify(['casadaauroraficticia@gmail.com', 'contato.casadaauroraficticia@gmail.com',
    'casaauroraficticia@gmail.com', 'contato.casaauroraficticia@gmail.com']), 'padrão: completo, contato.completo, sem conectivos, contato.sem conectivos');
  ok(JSON.stringify(CONFIG.ordemVariacoes) === JSON.stringify(['completo', 'contato.completo', 'sem_conectivos', 'contato.sem_conectivos']),
    'config.ordemVariacoes segue o histórico (36, 6, 1, 0 confirmações até 28/10)');
  const outra = libCom({ ...CONFIG, ordemVariacoes: ['contato.completo', 'completo'] }).variantesEmail('Casa da Aurora Fictícia', 'Vila Exemplo');
  ok(outra[0] === 'contato.casadaauroraficticia@gmail.com' && outra[1] === 'casadaauroraficticia@gmail.com' && outra.length === 4,
    'ordem configurável; padrões fora da lista vêm no fim, sem perder nenhum');
  const sem = variantesEmail('Aurora Fictícia Pet', 'Vila Exemplo');
  ok(sem.length === 2 && new Set(sem).size === 2, 'nome sem conectivo: 2 variações, sem duplicar');
}

// Simula o laço do n8n para um lead: Variações do nome → [Reservar 1 → Variações reservadas → Verifalia → Resultado →
// (Próxima variação?)]*. Devolve créditos gastos e o resultado final.
const lead = (id, nome) => ({ id, nome, cidade: 'Vila Exemplo' });
function verificarLead(sd, exec, L, statuses, { semCreditosNa = -1 } = {}) {
  const ini = rodar('b_variacoes.js', { input: [{ json: L }], staticData: sd, execId: exec })[0].json;
  if (!ini.email) return { creditos: 0, ...rodar('b_resultado_verificacao.js', { input: [{ json: ini }], staticData: sd, execId: exec, nodes: { 'Loop verificação': [{ json: L }] } })[0].json };
  let creditos = 0, r;
  for (;;) {
    const v = rodar('b_variacoes_reservadas.js', { staticData: sd, execId: exec })[0].json;
    const k = creditos++;
    const resp = k === semCreditosNa ? { input: v.email, error: 'verifalia 402', sem_creditos: true }
      : statuses[k] === 'erro' ? { input: v.email, error: 'verifalia 500' } : { input: v.email, is_reachable: statuses[k] };
    r = rodar('b_resultado_verificacao.js', { input: [{ json: resp }], staticData: sd, execId: exec, nodes: { 'Loop verificação': [{ json: L }] } })[0].json;
    if (r.disjuntor || r.semCreditos || !r.proxima) break;
    rodar('b_proxima_variacao.js', { staticData: sd, execId: exec });
  }
  return { creditos, ...r };
}

console.log('Uma variação por vez, parando no 1º confirmado');
{
  const sd = {};
  const a = verificarLead(sd, 'E1', lead('A', 'Casa da Aurora Fictícia'), ['safe', 'invalid', 'invalid', 'safe']);
  ok(a.safe && a.creditos === 1 && a.email === 'casadaauroraficticia@gmail.com' && !a.proxima, '1ª variação confirma → 1 crédito (antes: 4)');
  const b = verificarLead(sd, 'E1', lead('B', 'Casa da Aurora Fictícia'), ['invalid', 'safe', 'invalid', 'invalid']);
  ok(b.safe && b.creditos === 2 && b.email === 'contato.casadaauroraficticia@gmail.com', '2ª confirma → 2 créditos');
  const c = verificarLead(sd, 'E1', lead('C', 'Casa da Aurora Fictícia'), ['invalid', 'invalid', 'invalid', 'invalid']);
  ok(!c.safe && c.creditos === 4 && !c.incompleto && c.verificados.length === 4, 'nenhuma confirma → testa todas (4) e marca como verificado');
  const d = verificarLead(sd, 'E1', lead('D', 'Aurora Fictícia Pet'), ['invalid', 'invalid']);
  ok(!d.safe && d.creditos === 2, 'nome com 2 variações → no máximo 2 créditos');
  const e = verificarLead(sd, 'E1', lead('E', 'X'), []);
  ok(e.creditos === 0 && !e.safe && !e.incompleto, 'sem variação possível → 0 crédito (vai para o fallback, como antes)');
  const f = verificarLead(sd, 'E1', lead('F', 'Casa da Aurora Fictícia'), ['unknown', 'invalid', 'invalid', 'invalid']);
  ok(f.incompleto && f.creditos === 4, 'inconclusivo numa variação → segue as outras; sem confirmação o lead volta outro dia');
  const g = verificarLead(sd, 'E1', lead('G', 'Casa da Aurora Fictícia'), ['unknown', 'safe']);
  ok(g.safe && !g.incompleto && g.creditos === 2, 'inconclusivo seguido de confirmação → confirmado');
  const h = verificarLead({}, 'E2', lead('H', 'Casa da Aurora Fictícia'), ['invalid', 'invalid'], { semCreditosNa: 1 });
  ok(h.semCreditos && !h.proxima && h.creditos === 2, '402 da Verifalia → para na hora (sem próxima variação)');
}

console.log('Disjuntor continua por lead');
{
  const sd = {};
  const x1 = verificarLead(sd, 'E3', lead('X1', 'Casa da Aurora Fictícia'), ['unknown', 'unknown', 'unknown', 'unknown']);
  ok(!x1.disjuntor && x1.falhasSeguidas === 1, '4 variações inconclusivas do MESMO lead contam 1 (não abrem o disjuntor)');
  verificarLead(sd, 'E3', lead('X2', 'Aurora Fictícia Pet'), ['erro', 'unknown']);
  const x3 = verificarLead(sd, 'E3', lead('X3', 'Aurora Fictícia Pet'), ['unknown', 'unknown']);
  ok(x3.disjuntor && x3.falhasSeguidas === CONFIG.reacherFalhasSeguidasMax, `${CONFIG.reacherFalhasSeguidasMax} leads inconclusivos seguidos abrem`);
  const sd2 = {};
  verificarLead(sd2, 'E4', lead('Y1', 'Aurora Fictícia Pet'), ['unknown', 'unknown']);
  verificarLead(sd2, 'E4', lead('Y2', 'Aurora Fictícia Pet'), ['invalid', 'safe']);
  ok(sd2.reacherFalhas === 0, 'lead conclusivo zera o contador');
}

console.log('Estrutura do workflow');
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((x) => x.node);
  ok(/\/prospeccao_fila_verificacao\?select=\*&order=taxa_nicho\.desc,updated_at\.asc,id\.asc/.test(no('Buscar leads p/ verificação').parameters.url),
    'fila de verificação pela view priorizada (taxa do nicho desc, depois a mais antiga)');
  ok(saidas('Reacher travou?', 1)[0] === 'Próxima variação?' && saidas('Próxima variação?', 0)[0] === 'Próxima variação'
     && saidas('Próxima variação')[0] === 'Reservar Reacher (variações)' && saidas('Próxima variação?', 1)[0] === 'E-mail do nome confirmado?',
    'laço: sem confirmação e com variação restante → reserva 1 crédito e consulta a próxima');
  ok(saidas('Verifalia sem créditos? (variações)', 0)[0] === 'Sem orçamento Reacher' && saidas('Reacher liberado? (variações)', 1)[0] === 'Sem orçamento Reacher',
    '402 e teto do banco continuam encerrando a verificação do dia');
  ok(CONFIG.verificacaoPorExecucao >= 25, `lote de verificação ${CONFIG.verificacaoPorExecucao} (os 25 créditos deixam de ficar parados no lote de 15)`);
}

console.log('Migration 008');
{
  const sql = readFileSync(`${R}/../supabase/008_fila_verificacao_nicho.sql`, 'utf8').replace(/--.*$/gm, '');
  ok(!/\b(drop|alter|delete|update|insert|truncate)\b/i.test(sql), 'só cria views (aditiva)');
  ok(/security_invoker = true/.test(sql) && /revoke all on .*from anon, authenticated/.test(sql), 'security_invoker e sem acesso de anon/authenticated');
  ok(/status = 'novo' and l\.verificacao_codigo_em is null/.test(sql), 'mesmo filtro da fila antiga (novo e sem verificação)');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
