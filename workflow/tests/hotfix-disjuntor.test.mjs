// Hotfix 09/10: com o disjuntor do Reacher aberto na execução, a fila do dia fica sem fallback (dados fictícios).
// Uso: node workflow/tests/hotfix-disjuntor.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const rodar = (file, { input = [], nodes = {}, staticData = {}, execId = '1' } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: execId }, CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

const verificar = (sd, exec, status) => rodar('b_resultado_verificacao.js', { staticData: sd, execId: exec,
  input: [{ json: status === 'erro' ? { error: { message: 'timeout' } } : { input: 'exemplo@gmail.com', is_reachable: status } }],
  nodes: { 'Loop verificação': [{ json: { id: 'V', nome: 'Exemplo Fictício' } }] } })[0].json;
const fila = (sd, exec) => rodar('b_montar_fila.js', { staticData: sd, execId: exec, nodes: {
  'Calcular limite do dia': [{ json: { lote: 30 } }],
  'Buscar fila com e-mail': [{ json: { id: 'T', nome: 'Clínica Aurora Fictícia', cidade: 'Vila Exemplo',
    contatos: [{ id: 'c1', email: 'auroraficticia@exemplo.com.br', reacher_raw: {} }] } }],
  'Buscar fila fallback': [{ json: { id: 'F1', nome: 'Lead Um' } }, { json: { id: 'F2', nome: 'Lead Dois' } }],
} }).map((i) => i.json);

console.log('Hotfix 09/10: disjuntor aberto → sem fallback no dia');
{
  // Sequência de 09/10 (#518): 2 conclusivos, depois 3 inconclusivos seguidos → disjuntor.
  const sd = {};
  verificar(sd, 'E518', 'invalid'); verificar(sd, 'E518', 'invalid');
  verificar(sd, 'E518', 'unknown'); verificar(sd, 'E518', 'unknown');
  const d = verificar(sd, 'E518', 'erro');
  ok(d.disjuntor === true && d.falhasSeguidas === CONFIG.reacherFalhasSeguidasMax, 'cenário: disjuntor abre no 3º inconclusivo seguido');
  const f = fila(sd, 'E518');
  ok(!f.some((l) => l.fila.modo === 'fallback'), 'fila sem nenhum lead de fallback');
  ok(f.length === 1 && f[0].id === 'T' && f[0].fila.modo === 'texto', 'quem já tem e-mail confirmado continua na fila (não usa o Reacher)');
}
{
  const sd = {};
  verificar(sd, 'E1', 'unknown'); verificar(sd, 'E1', 'invalid');
  const f = fila(sd, 'E1');
  ok(f.filter((l) => l.fila.modo === 'fallback').length === 2, 'inconclusivo isolado (disjuntor fechado) → fallback normal');
}
{
  const sd = {};
  verificar(sd, 'E1', 'unknown'); verificar(sd, 'E1', 'unknown'); verificar(sd, 'E1', 'unknown');
  ok(fila(sd, 'E2').filter((l) => l.fila.modo === 'fallback').length === 2, 'disjuntor de uma execução anterior não afeta a execução seguinte');
  ok(fila({}, 'E3').filter((l) => l.fila.modo === 'fallback').length === 2, 'sem verificação no dia (static data vazio) → fallback normal');
}
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
  const js = w.nodes.find((n) => n.name === 'Montar fila de envio').parameters.jsCode;
  ok(js.includes('disjuntorAberto') && js.includes('reacherFalhasSeguidasMax'), 'dist: "Montar fila de envio" com a regra do disjuntor');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
