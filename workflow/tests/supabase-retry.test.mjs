// Hotfix 03/11 (#602): um EHOSTUNREACH de ~2 s na reserva do Supabase derrubou a execução das 09:30 inteira (0 envios,
// com 1 contato já confirmado). Dados fictícios. Uso: node workflow/tests/supabase-retry.test.mjs
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

const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
const wd = JSON.parse(readFileSync(`${R}/dist/novax-robson-watchdog.json`, 'utf8'));
const no = (n) => w.nodes.find((x) => x.name === n);
const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((x) => x.node);
const supa = (wf) => wf.nodes.filter((n) => n.type.endsWith('httpRequest') && /supabase\.co/.test(n.parameters.url || ''));

console.log('Retry em todo nó do Supabase');
{
  const semRetry = [...supa(w), ...supa(wd)].filter((n) => !(n.retryOnFail && n.maxTries === 3 && n.waitBetweenTries === 3000));
  ok(supa(w).length > 30 && semRetry.length === 0, `${supa(w).length} nós do Supabase no Robson e ${supa(wd).length} no watchdog, todos com 3 tentativas / 3 s`
    + (semRetry.length ? ` (faltam: ${semRetry.map((n) => n.name).join(', ')})` : ''));
}

console.log('Reserva que falha cai no ramo fechado (sem consulta), sem derrubar a execução');
{
  const reservas = [['Reservar Reacher (variações)', 'Reacher liberado? (variações)'], ['Reservar Reacher (candidatos)', 'Reacher liberado? (candidatos)'],
    ['Reservar cota IA (e-mail)', 'Cota IA ok? (e-mail)'], ['Reservar cota IA (resposta)', 'Cota IA ok? (resposta)'], ['Reservar cota Places', 'Cota Places ok?']];
  for (const [r, se] of reservas) {
    ok(no(r).onError === 'continueRegularOutput' && saidas(r)[0] === se && /\$json\.ok === true/.test(no(se).parameters.conditions.conditions[0].leftValue),
      `"${r}" segue com erro → "${se}" ($json.ok === true; erro = falso)`);
  }
  ok(saidas('Reacher liberado? (variações)', 1)[0] === 'Sem orçamento Reacher' && saidas('Sem orçamento Reacher')[0] === 'Fim da verificação'
     && saidas('Fim da verificação')[0] === 'Buscar fila com e-mail', 'variações: reserva falhou → "Sem orçamento Reacher" → fim da verificação → fila de envio');
  ok(saidas('Reacher liberado? (variações)', 0)[0] === 'Variações reservadas', 'só o ramo "liberado" chega na Verifalia');
  // Fora as reservas, nenhum nó do Supabase ganhou onError novo (escrita que falha 3 vezes continua parando a execução).
  const soft = supa(w).filter((n) => n.onError).map((n) => n.name).sort();
  const esperado = ['Gravar resposta bruta', 'Motor v2: só registra', 'Registrar ação v1', 'Reservar Reacher (candidatos)', 'Reservar Reacher (variações)',
    'Reservar cota IA (e-mail)', 'Reservar cota IA (resposta)', 'Reservar cota Places', 'Reservar cota Places (p2)', 'Reservar cota Places (p3)'].sort();
  ok(JSON.stringify(soft) === JSON.stringify(esperado), 'tolerância a erro só nas reservas e nos registros de resposta que já a tinham');
}

console.log('Cenário da #602 no código');
{
  // Saída do HTTP com onError = continue: item com { error }, sem "ok".
  const erroRede = { error: { message: 'The host is unreachable, perhaps the server is offline', code: 'EHOSTUNREACH' } };
  const sd = {};
  const s = rodar('b_sem_orcamento_reacher.js', { input: [{ json: erroRede }], staticData: sd, execId: 'E602' })[0].json;
  ok(s.semOrcamentoReacher === true && sd.reacherSemOrcamentoExec === 'E602', 'reserva com erro de rede → mesmo caminho de "sem orçamento" (encerra a verificação do dia)');
  const fila = rodar('b_montar_fila.js', { staticData: sd, execId: 'E602', nodes: {
    'Calcular limite do dia': [{ json: { lote: 45 } }],
    'Buscar fila com e-mail': [{ json: { id: 'T1', nome: 'Oficina Aurora Fictícia', cidade: 'Vila Exemplo',
      contatos: [{ id: 'c1', email: 'oficinaauroraficticia@gmail.com', reacher_raw: {} }] } }],
    'Buscar fila fallback': [{ json: { id: 'F1', nome: 'Lead Fictício' } }] } }).map((i) => i.json);
  ok(fila.length === 1 && fila[0].id === 'T1' && fila[0].fila.modo === 'texto',
    'o contato confirmado vai para a fila de envio; o fallback (que gastaria Verifalia) fica fora no dia');
  const ctx = { lead: { id: 'L', nome: 'Exemplo', cidade: 'C', estado: 'GO' }, resposta: { from: 'a@exemplo.com', texto: 'Quero saber mais' } };
  const rev = rodar('c_revisao.js', { input: [{ json: erroRede }], nodes: { 'Contexto da resposta': [{ json: ctx }] } })[0].json;
  ok(/reserva da cota de IA falhou/.test(rev.lead_patch.motivo_revisao) && rev.acao_v1 === 'revisao_manual',
    'resposta de lead com reserva de IA falhando → revisão manual com motivo claro (não "undefined tentativa(s)")');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
