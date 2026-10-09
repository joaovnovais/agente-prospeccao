// Orçamento diário GLOBAL do Reacher (09/10, migration 007). Offline, dados fictícios.
// Uso: node workflow/tests/reacher-orcamento.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const SQL = readFileSync(`${R}/../supabase/007_reacher_orcamento.sql`, 'utf8');
const rodar = (file, { input = [], nodes = {}, staticData = {}, execId = '1' } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: execId }, CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Teto e migration 007');
const tetoSql = Number((SQL.match(/v_limite constant integer := (\d+)/) || [])[1]);
ok(tetoSql === 25 && CONFIG.reacherLimiteDiario === tetoSql, 'teto 25/dia na função do Supabase = config.reacherLimiteDiario');
ok(!/p_limite/.test(SQL), 'o teto não é parâmetro da função (quem chama não escolhe o teto)');
ok(/check \(servico in \('openrouter', 'google_places', 'reacher'\)\)/.test(SQL), 'contador aceita "reacher" e mantém os serviços antigos');
ok(/security definer/.test(SQL) && /grant execute on function public\.prospeccao_reservar_reacher\(integer, text\) to service_role, anon;/.test(SQL),
   'função de reserva para o Robson (service_role) e scripts locais (anon)');
ok(/revoke all on public\.prospeccao_reacher_reservas from anon, authenticated/.test(SQL) && !/\b(delete from|drop table|truncate)\b/i.test(SQL),
   'tabela de reservas fechada para anon/authenticated; nada destrutivo');
ok(/p_qtd < 1 or p_qtd > v_limite/.test(SQL) && /chamadas \+ p_qtd <= v_limite/.test(SQL), 'reserva tudo-ou-nada, sem passar do teto');

console.log('Workflow: nenhuma consulta ao Reacher sem reserva antes');
const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
const no = (n) => w.nodes.find((x) => x.name === n);
const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((c) => c.node);
const pais = (n) => Object.entries(w.connections).flatMap(([de, c]) => c.main.flatMap((br, i) => (br || []).filter((x) => x.node === n).map(() => ({ de, i }))));
const reacher = w.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest' && String(n.parameters.url).includes(CONFIG.reacherUrl));
ok(reacher.length === 2, `2 nós consultam o Reacher (${reacher.map((n) => n.name).join(', ')})`);
for (const r of reacher) {
  // sobe a cadeia até achar um "Reacher liberado?" (ramo verdadeiro) sem passar por outro Reacher
  const visto = new Set(); let achou = true; const fila = pais(r.name).map((p) => p.de);
  if (!fila.length) achou = false;
  while (fila.length) {
    const p = fila.shift(); if (visto.has(p)) continue; visto.add(p);
    if (p.startsWith('Reacher liberado?')) continue;
    const ps = pais(p); if (!ps.length || reacher.some((x) => x.name === p)) { achou = false; break; }
    for (const q of ps) { if (q.de.startsWith('Reacher liberado?') && q.i !== 0) { achou = false; } fila.push(q.de); }
  }
  ok(achou, `"${r.name}" só é alcançado pelo ramo "liberado" de uma reserva`);
}
ok(saidas('Tem variação?')[0] === 'Reservar Reacher (variações)' && saidas('Reservar Reacher (variações)')[0] === 'Reacher liberado? (variações)', 'variações: reserva antes');
ok(saidas('Reacher liberado? (variações)', 0)[0] === 'Variações reservadas' && saidas('Variações reservadas')[0] === 'Reacher - variações do nome', 'liberado → consulta');
ok(saidas('Reacher liberado? (variações)', 1)[0] === 'Sem orçamento Reacher' && saidas('Sem orçamento Reacher')[0] === 'Fim da verificação', 'sem orçamento → encerra a verificação do dia');
ok(saidas('Há candidatos novos?')[0] === 'Reservar Reacher (candidatos)' && saidas('Reacher liberado? (candidatos)', 0)[0] === 'Separar candidatos'
   && saidas('Reacher liberado? (candidatos)', 1)[0] === 'Parar: orçamento do Reacher', 'candidatos: reserva antes; sem orçamento → para o loop');
ok(saidas('Reacher travou?', 0)[0] === 'Registrar disjuntor' && saidas('Registrar disjuntor')[0] === 'Fim da verificação', 'disjuntor registrado no Supabase');
ok(['Reservar Reacher (variações)', 'Reservar Reacher (candidatos)', 'Registrar disjuntor'].every((n) => no(n).executeOnce === true), 'reservas e registro rodam 1 vez por lote');
ok(/p_qtd: \$\('Variações do nome'\)\.all\(\)\.filter/.test(no('Reservar Reacher (variações)').parameters.jsonBody)
   && /p_origem: 'robson:variacoes'/.test(no('Reservar Reacher (variações)').parameters.jsonBody), 'variações: reserva o nº de e-mails do lote, origem robson:variacoes');
ok(/p_qtd: \$json\.candidatos\.length/.test(no('Reservar Reacher (candidatos)').parameters.jsonBody), 'candidatos: reserva o nº de candidatos');

console.log('Código dos nós');
{
  const v = rodar('b_variacoes_reservadas.js', { nodes: { 'Variações do nome': [{ json: { email: 'a@gmail.com' } }, { json: {} }, { json: { email: 'b@gmail.com' } }] } });
  ok(v.length === 2 && v.every((i) => i.json.email), 'variações reservadas = só as que têm e-mail (mesmo nº da reserva)');
  const sd = {};
  const s = rodar('b_sem_orcamento_reacher.js', { input: [{ json: { ok: false, usadas: 25, limite: 25 } }], staticData: sd, execId: 'E9' })[0].json;
  ok(s.semOrcamentoReacher === true && sd.reacherSemOrcamentoExec === 'E9', 'sem orçamento: marca a execução');
  const fila = rodar('b_montar_fila.js', { staticData: sd, execId: 'E9', nodes: {
    'Calcular limite do dia': [{ json: { lote: 30 } }],
    'Buscar fila com e-mail': [{ json: { id: 'T', nome: 'Clínica Aurora Fictícia', cidade: 'Vila Exemplo', contatos: [{ id: 'c', email: 'auroraficticia@exemplo.com.br', reacher_raw: {} }] } }],
    'Buscar fila fallback': [{ json: { id: 'F', nome: 'Lead Fictício' } }] } }).map((i) => i.json);
  ok(fila.length === 1 && fila[0].fila.modo === 'texto', 'sem orçamento → fila sem fallback; e-mail confirmado continua');
  const c = rodar('b_separar_candidatos.js', { input: [{ json: { ok: true, usadas: 3, limite: 25 } }],
    nodes: { 'Validar resposta IA - e-mail': [{ json: { candidatos: ['x@gmail.com', 'y@gmail.com'] } }] } });
  ok(c.length === 2 && c[0].json.email === 'x@gmail.com', 'separar candidatos lê do validador (a entrada agora é a reserva)');
}

console.log('Watchdog: Reacher no resumo e alertas');
{
  const cen = (uso, reservas) => rodar('w_resumo.js', { nodes: { 'Janela de hoje': [{ json: { dia: '2026-10-13', inicio: '2026-10-13T03:00:00.000Z', diaUtil: true } }],
    'W: status envio': [{ json: { primeiro_envio: '2026-09-29T12:31:52.982Z' } }], 'W: envios hoje': [{ json: {} }], 'W: verificados hoje': [{ json: { id: 1 } }],
    'W: contatos hoje': [{ json: {} }], 'W: uso API hoje': [{ json: { servico: 'reacher', chamadas: uso } }], 'W: respostas hoje': [{ json: {} }],
    'W: fila sem verificação': [{ json: {} }], 'W: contatos pendentes': [{ json: {} }], 'W: Reacher hoje': reservas.map((json) => ({ json })) } })[0].json;
  const normal = cen(23, [{ origem: 'robson:variacoes', qtd: 14, ok: true }, { origem: 'robson:candidatos', qtd: 9, ok: true }]);
  ok(normal.texto.includes('Reacher: 23 de 25 consultas (robson:variacoes 14, robson:candidatos 9)') && !normal.alertas.some((a) => /Reacher/.test(a)),
     'dia normal: linha com uso por origem, sem alerta do Reacher');
  const trav = cen(5, [{ origem: 'robson:variacoes', qtd: 5, ok: true }, { origem: 'robson:disjuntor', qtd: 0, ok: false }]);
  ok(trav.alertas.some((a) => /Reacher travou/.test(a)) && trav.assunto.startsWith('[ALERTA Robson]') && trav.texto.includes('disjuntor abriu'),
     'disjuntor (cenário de 09/10) → [ALERTA Robson] com "Reacher travou"');
  const esg = cen(25, [{ origem: 'robson:variacoes', qtd: 25, ok: true }, { origem: 'robson:candidatos', qtd: 3, ok: false }]);
  ok(esg.alertas.some((a) => /orçamento do Reacher esgotado \(25 de 25\)/.test(a)), 'reserva negada → alerta de orçamento esgotado');
  ok(cen(0, []).texto.includes('Reacher: 0 de 25 consultas'), 'sem reservas (ou view/tabela ausente) → 0, sem quebrar');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
