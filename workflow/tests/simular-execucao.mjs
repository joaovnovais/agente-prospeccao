// Replay de uma execução real do "Diário - Envio" com o código atual: reaproveita as respostas da IA e os resultados do
// Reacher gravados na execução e conta quantas chamadas e envios o código novo teria feito (ordem da fila, atalho sem
// candidato, assunto corrigido, teto do fallback, cota da IA). Não chama IA, Reacher nem banco.
// Os dados reais ficam fora do repositório (docs/local/, gitignored). A saída mostra só IDs curtos e contagens.
// Uso: node workflow/tests/simular-execucao.mjs docs/local/execucao-507.json [--ordem-original]
//   --ordem-original: mantém a ordem da fila da execução (sem priorizar o fallback por avaliações), para comparar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const rodar = (file, { input = [], nodes = {}, staticData = {} } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, CONFIG);
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sid = (l) => String(l.id).slice(0, 8);
const ORDEM_ORIGINAL = process.argv.includes('--ordem-original');
const LIMITE_ENVIOS = 10;

// Observado na execução original.
const porLead = new Map();
for (const c of d.chamadas) { const k = c.lead.id; if (!porLead.has(k)) porLead.set(k, []); porLead.get(k).push(c); }
console.log(`Execução #${d.execucao} (original): ${d.chamadas.length} chamadas, ${d.pedidos_sem_resposta} pedido(s) barrado(s) pela cota.`);

// Fila com o código novo: mesmos leads, b_montar_fila atual (texto primeiro; fallback por avaliações).
const filaNova = rodar('b_montar_fila.js', { nodes: {
  'Calcular limite do dia': [{ json: { lote: d.fila.length } }],
  'Buscar fila com e-mail': d.fila.filter((l) => l.fila?.modo === 'texto').map(({ fila: f, ...l }) => ({ json: { ...l, contatos: [{ id: f.contato_id, email: f.email, reacher_raw: f.reacher }] } })),
  'Buscar fila fallback': d.fila.filter((l) => l.fila?.modo !== 'texto').map(({ fila: f, ...l }) => ({ json: l })),
} }).map((i) => i.json);
const fila = ORDEM_ORIGINAL ? d.fila : filaNova;
console.log(ORDEM_ORIGINAL ? 'Ordem da fila: original (sem prioridade por avaliações).' : 'Ordem da fila: código novo (fallback por avaliações).');

const sd = {};
let chamadas = 0, envios = 0, chamadasFallback = 0, parada = null;
const linhas = [];
const tot = { semDados: 0, enviados: [], provaveis: [], descartados: 0, naoProcessados: 0 };
for (const l of fila) {
  if (parada) { tot.naoProcessados++; linhas.push(`  ${sid(l)} ${l.fila.modo.padEnd(8)} aval=${l.total_avaliacoes} → não processado (${parada})`); continue; }
  if (envios >= LIMITE_ENVIOS) { parada = 'limite de envios'; tot.naoProcessados++; continue; }
  const resp = porLead.get(l.id) || [];
  let usadas = 0, fim = null;
  for (let t = 1; t <= CONFIG.maxTentativasIA && !fim; t++) {
    const ped = rodar('b_pedido_ia.js', { input: [{ json: t === 1 ? { lead: l } : { lead: l, tentativa: t, messages: [{ role: 'user', content: 'retry' }] } }], staticData: sd })[0].json;
    if (ped.teto_fallback) { parada = 'teto do fallback'; fim = 'teto'; break; }
    if (chamadas >= CONFIG.limiteDiarioOpenRouter) { parada = 'cota da IA'; fim = 'cota'; break; }
    chamadas++; usadas++; if (l.fila.modo !== 'texto') chamadasFallback++;
    const r = resp[t - 1];
    if (!r) { fim = 'sem dados'; break; }
    const v = rodar('b_validar_ia.js', { input: [{ json: r.resposta }], nodes: { 'Pedido IA - e-mail': [{ json: { lead: l, tentativa: t, messages: [] } }] } })[0].json;
    if (!v.ok) { if (t === CONFIG.maxTentativasIA) fim = 'revisão manual'; continue; }
    if (l.fila.modo === 'texto') { fim = 'enviado'; break; }
    if (v.sem_candidato) { fim = 'sem_email (sem candidato)'; break; }
    const st = v.candidatos.map((e) => d.reacher[e] || 'não consultado');
    fim = st.includes('safe') ? 'enviado' : st.includes('não consultado') ? 'Reacher sem dados' : 'sem_email (Reacher)';
  }
  if (fim === 'enviado') { envios++; tot.enviados.push(sid(l)); }
  else if (fim === 'sem dados' || fim === 'Reacher sem dados') { tot.semDados++; if (l.fila.modo === 'texto') tot.provaveis.push(sid(l)); }
  else if (fim && fim.startsWith('sem_email')) tot.descartados++;
  if (fim === 'teto' || fim === 'cota') { tot.naoProcessados++; linhas.push(`  ${sid(l)} ${l.fila.modo.padEnd(8)} aval=${l.total_avaliacoes} → não processado (${parada})`); continue; }
  linhas.push(`  ${sid(l)} ${l.fila.modo.padEnd(8)} aval=${l.total_avaliacoes} chamadas=${usadas} (original ${resp.length}) → ${fim}`);
}
console.log(linhas.join('\n'));
console.log(`\nCódigo novo: ${chamadas} chamadas (fallback ${chamadasFallback}/${CONFIG.maxChamadasFallbackDia}), ${envios} envios confirmados pelo replay`
  + `${tot.provaveis.length ? ` + ${tot.provaveis.length} com e-mail confirmado que precisaria de 1 chamada a mais (sem resposta gravada): ${tot.provaveis.join(', ')}` : ''}.`);
console.log(`Descartados: ${tot.descartados}. Sem dados para concluir: ${tot.semDados}. Não processados: ${tot.naoProcessados}${parada ? ` (parou por: ${parada})` : ''}.`);
