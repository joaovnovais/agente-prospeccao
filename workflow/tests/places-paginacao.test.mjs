// Paginação do Places e rotação do termo (07/10). Offline, dados fictícios. Uso: node workflow/tests/places-paginacao.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
// Simula um Code node do n8n. Nó ausente em `nodes` = nó não executado: $(n).all() lança erro, como no n8n.
const rodar = (file, { input = [], nodes = {}, pre = '', config = CONFIG } = {}) =>
  new Function('$input', '$', 'CONFIG', LIB + '\n' + pre + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input },
    (n) => {
      if (!(n in nodes)) throw new Error(`Referenced node is unexecuted: ${n}`);
      const its = nodes[n];
      return { first: () => its[0], all: () => its, itemMatching: (i) => its[i] };
    }, config);
const emData = (iso, fn) => { const real = Date.now; Date.now = () => new Date(iso).getTime(); try { return fn(); } finally { Date.now = real; } };
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Config');
ok(CONFIG.paginacao.paginasMax === 3 && CONFIG.paginacao.minSemSiteParaProximaPagina === 3, 'paginação: até 3 páginas, próxima só com >= 3 sem site');
ok(CONFIG.rotacao.cidadesPorNicho === 10 && CONFIG.rotacao.nichosPorSemana === 4, '4 nichos × 10 cidades = 40 buscas de página 1, sobra orçamento para as páginas 2-3');
ok(CONFIG.limitePlacesPorExecucao === 60 && CONFIG.tetoMensalPlaces === 300, 'tetos inalterados: 60 por execução, 300 por mês');

console.log('Planejador: rotação do termo');
const semanaDe = (w) => emData(new Date(new Date(CONFIG.inicioRotacao + 'T10:00:00Z').getTime() + w * 7 * 864e5).toISOString(),
  () => rodar('a_montar_buscas.js').map((i) => i.json));
const s0 = semanaDe(0);
ok(s0.length === 40 && s0.every((b) => b.pagina === 1), 'semana 0: 40 buscas, todas página 1');
ok(s0.every((b) => b.textQuery.startsWith(b.termo + ' em ')), 'textQuery usa o termo registrado na busca');
ok(['oficina mecânica', 'salão de beleza', 'pet shop', 'loja de material de construção'].every((t) => s0.some((b) => b.termo === t)),
   'semana 0 com o 1º termo dos 4 nichos novos (igual à checagem de 12/10)');
// Histórico de ~2 ciclos completos do catálogo: (nicho, cidade, termo) nunca repete para nicho com 2 termos.
const N = CONFIG.catalogoNichos.length, fatias = Math.ceil(56 / CONFIG.rotacao.cidadesPorNicho);
const semanas = Math.ceil((2 * fatias * N) / CONFIG.rotacao.nichosPorSemana);
const hist = Array.from({ length: semanas }, (_, w) => semanaDe(w)).flat();
const ocorr = (nicho) => [...new Set(hist.filter((b) => b.nicho === nicho).map((b) => `${b.semana}`))];
const termosPorVolta = (nicho) => ocorr(nicho).map((w) => hist.find((b) => b.nicho === nicho && String(b.semana) === w).termo);
const t2 = termosPorVolta('oficina_mecanica');
ok(t2[0] === 'oficina mecânica' && t2[1] === 'auto center' && t2[2] === 'oficina mecânica', 'nicho de 2 termos: cada volta usa o próximo termo (1º, 2º, 1º…)');
const dup = (nicho) => { const c = new Map(); for (const b of hist.filter((x) => x.nicho === nicho)) { const k = `${b.cidade}|${b.termo}`; c.set(k, (c.get(k) || 0) + 1); } return [...c.values()].filter((v) => v > 1).length; };
ok(CONFIG.catalogoNichos.filter((n) => n.termos.length >= 2).every((n) => dup(n.nicho) === 0),
   `em ~2 ciclos (${semanas} semanas), nenhum nicho de 2 termos repete cidade+termo`);
const cid = (nicho) => new Set(hist.filter((b) => b.nicho === nicho).map((b) => b.cidade)).size;
ok(cid('oficina_mecanica') === 56, 'o nicho cobre as 56 cidades (GO+SC) no ciclo');
ok(dup('advocacia') > 0, 'nicho de 1 termo repete a busca no ciclo seguinte (é aí que as páginas 2-3 trazem resultado novo)');
ok(emData('2026-12-01T10:00:00Z', () => rodar('a_montar_buscas.js', { config: { ...CONFIG, catalogoNichos: CONFIG.catalogoNichos.map((n, i) => (i === 0 ? { ...n, termoInicial: 1 } : n)) } }))
   .map((i) => i.json).length > 0, 'termoInicial por nicho é aceito (desloca o 1º termo de um nicho já buscado)');

console.log('Filtro: estatística por busca e origem da onda');
const lugar = (id, site, status = 'OPERATIONAL') => ({ id, displayName: { text: `Empresa Fictícia ${id}` }, formattedAddress: 'Rua Exemplo, 1',
  websiteUri: site ? 'https://exemplo.com.br' : undefined, businessStatus: status, types: ['car_repair'] });
const ctx = (cidade, pagina = 1, extra = {}) => ({ json: { nicho: 'oficina_mecanica', cidade, estado: 'GO', semana_ciclo: 1, ciclo: 0, semana: 0, termo: 'oficina mecânica',
  pagina, textQuery: `oficina mecânica em ${cidade} - GO`, ...extra } });
{
  const places = [
    { json: { places: [lugar('a1', false), lugar('a2', false), lugar('a3', false), lugar('a4', true), lugar('a5', false, 'CLOSED_PERMANENTLY')], nextPageToken: 'TOK-A' } },
    { json: { places: [lugar('b1', false), lugar('b2', true)] } },
    { json: { error: { message: 'quota' } } },
  ];
  const f = rodar('a_filtrar_places.js', { input: places, pre: "const ORIGEM_BUSCA = 'Montar buscas da semana';",
    nodes: { 'Montar buscas da semana': [ctx('Cidade Alfa'), ctx('Cidade Beta'), ctx('Cidade Gama')] } })[0].json;
  ok(f.total === 4 && f.rows.every((r) => r.nicho === 'oficina_mecanica'), 'linhas de lead como antes (4 sem site operando)');
  ok(f.buscas.length === 2 && f.buscas[0].sem_site === 3 && f.buscas[0].token === 'TOK-A' && f.buscas[1].token === null,
     'por busca: sem site operando na página e nextPageToken');
  ok(f.erros.length === 1 && /pág\. 1/.test(f.erros[0]), 'erro do Places registrado com a página');
  const f2 = rodar('a_filtrar_places.js', { input: [{ json: { places: [lugar('c1', false)] } }], pre: "const ORIGEM_BUSCA = 'Próxima página (p2)';",
    nodes: { 'Próxima página (p2)': [ctx('Cidade Alfa', 2, { pageToken: 'TOK-A', sem_site_pagina_anterior: 3 })] } })[0].json;
  ok(f2.rows[0].cidade === 'Cidade Alfa' && f2.buscas[0].pagina === 2 && !('pageToken' in f2.buscas[0]), 'onda 2 lê o contexto do nó da onda (cidade, página)');
}

console.log('Próxima página: produtividade, orçamento e limite de páginas');
{
  const buscas = [
    { textQuery: 'q1', pagina: 1, sem_site: 3, token: 'T1', resultados: 20 }, { textQuery: 'q2', pagina: 1, sem_site: 9, token: 'T2', resultados: 20 },
    { textQuery: 'q3', pagina: 1, sem_site: 2, token: 'T3', resultados: 20 }, { textQuery: 'q4', pagina: 1, sem_site: 7, token: null, resultados: 12 },
    { textQuery: 'q5', pagina: 1, sem_site: 5, token: 'T5', resultados: 20 },
  ];
  const prox = (gastas, proxima = 2, bs = buscas) => rodar('a_proxima_pagina.js', {
    pre: `const FILTRO = 'Filtrar sem site + exclusões'; const PROXIMA = ${proxima}; const PLACES = ['Places - Text Search'];`,
    nodes: { 'Filtrar sem site + exclusões': [{ json: { buscas: bs } }], 'Places - Text Search': Array.from({ length: gastas }, () => ({ json: {} })) } }).map((i) => i.json);
  const p = prox(40);
  ok(p.map((b) => b.textQuery).join(',') === 'q2,q5,q1', 'só com token e >= 3 sem site, das mais produtivas para as menos');
  ok(p.every((b) => b.pagina === 2 && b.pageToken && !('token' in b) && !('sem_site' in b)), 'item da página 2 leva pageToken e o contexto da busca');
  ok(prox(58).length === 2, 'orçamento: 58 de 60 gastas → só 2 páginas');
  const fim = prox(60);
  ok(fim.length === 1 && fim[0].fim === true, 'orçamento esgotado → { fim: true } (segue para o resumo)');
  ok(prox(10, 4)[0].fim === true, 'nunca passa de paginasMax (página 4 não existe)');
  ok(prox(10, 2, [])[0].fim === true, 'sem buscas → fim');
  const ondas3 = rodar('a_proxima_pagina.js', {
    pre: "const FILTRO = 'Filtrar sem site + exclusões (p2)'; const PROXIMA = 3; const PLACES = ['Places - Text Search', 'Places - Text Search (p2)'];",
    nodes: { 'Filtrar sem site + exclusões (p2)': [{ json: { buscas } }], 'Places - Text Search': Array.from({ length: 40 }, () => ({ json: {} })),
             'Places - Text Search (p2)': Array.from({ length: 18 }, () => ({ json: {} })) } }).map((i) => i.json);
  ok(ondas3.length === 2, 'orçamento soma todas as ondas (40 + 18 → sobram 2 para a página 3)');
  const naoExec = rodar('a_proxima_pagina.js', { pre: "const FILTRO = 'Filtrar sem site + exclusões'; const PROXIMA = 2; const PLACES = ['Places - Text Search'];", nodes: {} }).map((i) => i.json);
  ok(naoExec[0].fim === true, 'nó anterior não executado → fim, sem erro');
}

console.log('Resumo somando as ondas');
{
  const ONDAS = [1, 2, 3].map((k) => { const s = k === 1 ? '' : ` (p${k})`; return { filtro: `Filtrar sem site + exclusões${s}`, upsert: `Upsert leads${s}`, places: `Places - Text Search${s}` }; });
  const r = rodar('a_resumo.js', { pre: `const ONDAS = ${JSON.stringify(ONDAS)};`, nodes: {
    'Filtrar sem site + exclusões': [{ json: { total: 10, excluidos: ['x'], erros: [] } }], 'Upsert leads': [{ json: { id: 1 } }, { json: { id: 2 } }],
    'Places - Text Search': Array.from({ length: 40 }, () => ({ json: {} })),
    'Filtrar sem site + exclusões (p2)': [{ json: { total: 6, excluidos: [], erros: ['e'] } }], 'Upsert leads (p2)': [{ json: {} }],
    'Places - Text Search (p2)': Array.from({ length: 12 }, () => ({ json: {} })) } })[0].json;
  ok(r.leads_novos === 2 && r.sem_site_encontrados === 16 && r.chamadas_places === 52, 'soma novos, sem site e chamadas das ondas executadas');
  ok(r.por_pagina[2].chamadas === 0 && r.excluidos_lista_manual.length === 1 && r.erros_places.length === 1, 'onda não executada conta zero; listas juntas');
  ok(['leads_novos', 'sem_site_encontrados', 'excluidos_lista_manual', 'erros_places'].every((k) => k in r), 'campos antigos mantidos (checagem e leitor)');
}

console.log('Estrutura do workflow');
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((c) => c.node);
  const mask = (n) => no(n).parameters.headerParameters.parameters.find((h) => h.name === 'X-Goog-FieldMask').value;
  ok(['', ' (p2)', ' (p3)'].every((s) => no(`Places - Text Search${s}`) && /(^|,)nextPageToken(,|$)/.test(mask(`Places - Text Search${s}`))), 'as 3 ondas pedem nextPageToken no field mask');
  ok(/pageToken: \$\('Próxima página \(p2\)'\)\.item\.json\.pageToken/.test(no('Places - Text Search (p2)').parameters.jsonBody), 'página 2 envia o pageToken da busca');
  ok(['', ' (p2)', ' (p3)'].every((s) => /p_limite: 300/.test(no(`Reservar cota Places${s}`).parameters.jsonBody)), 'cada página reserva 1 na cota mensal (teto 300)');
  ok(saidas('Upsert leads')[0] === 'Próxima página (p2)' && saidas('Há leads novos?', 1)[0] === 'Próxima página (p2)', 'onda 1 → próxima página, com ou sem lead novo');
  ok(saidas('Há página 2?', 0)[0] === 'Reservar cota Places (p2)' && saidas('Há página 2?', 1)[0] === 'Resumo captação', 'sem página 2 → resumo');
  ok(saidas('Upsert leads (p3)')[0] === 'Resumo captação' && saidas('Há leads novos? (p3)', 1)[0] === 'Resumo captação', 'última onda → resumo');
  ok(['', ' (p2)', ' (p3)'].every((s) => no(`Upsert leads${s}`).alwaysOutputData === true), 'upserts sempre devolvem item (o fluxo não para se todo lead já existia)');
  ok(no('Places - Text Search (p3)') && !no('Places - Text Search (p4)'), 'exatamente 3 páginas (60 resultados) por busca');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
