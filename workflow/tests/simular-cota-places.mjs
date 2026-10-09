// Simulação do uso da cota do Places por mês (07/10): roda o planejador e o nó "Próxima página" reais em cada segunda-feira,
// sorteando PMEs sem site por página da distribuição real das 38 buscas de 27/09 e 05/10 (todas vieram cheias, 20 resultados).
// Hipóteses (ajustáveis por argumento): toda busca tem página seguinte (pior caso para a cota) e as páginas 2-3 rendem
// FATOR × o que rende a página 1 (1 = mesmo rendimento; 0.5 = metade). Não chama API nenhuma.
// Uso: node workflow/tests/simular-cota-places.mjs [FATOR=1] [RODADAS=2000]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const BASE = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const FATOR = Number(process.argv[2] || 1), RODADAS = Number(process.argv[3] || 2000);
const REAL = [2, 5, 7, 7, 5, 4, 2, 11, 9, 9, 9, 5, 1, 0, 0, 1, 1, 1, 2, 0, 1, 1, 6, 3, 2, 3, 6, 6, 5, 2, 5, 9, 3, 4, 8, 6, 6, 5]; // sem site por página 1
const rodar = (file, cfg, nodes = {}, pre = '') => new Function('$input', '$', 'CONFIG', LIB + '\n' + pre + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
  { first: () => undefined, all: () => [] },
  (n) => { if (!(n in nodes)) throw new Error('unexecuted ' + n); return { all: () => nodes[n], first: () => nodes[n][0] }; }, cfg);
const emData = (iso, fn) => { const real = Date.now; Date.now = () => new Date(iso).getTime(); try { return fn(); } finally { Date.now = real; } };
const sorteia = (f) => { const v = REAL[Math.floor(Math.random() * REAL.length)] * f; return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0); };
const segundas = []; for (let d = new Date('2026-10-12T10:00:00Z'); d < new Date('2027-01-01'); d = new Date(d.getTime() + 7 * 864e5)) segundas.push(d.toISOString());

function execucao(cfg, iso) {
  const p1 = emData(iso, () => rodar('a_montar_buscas.js', cfg)).map((i) => i.json);
  let chamadas = p1.length, semSite = 0;
  let ondaAnt = p1.map((b) => { const s = sorteia(1); semSite += s; return { ...b, sem_site: s, token: 'T' }; });
  const places = [Array.from({ length: p1.length }, () => ({}))];
  for (let k = 2; k <= ((cfg.paginacao && cfg.paginacao.paginasMax) || 1); k++) {
    const nomes = places.map((_, i) => `P${i + 1}`);
    const nodes = { F: [{ json: { buscas: ondaAnt } }] }; places.forEach((pl, i) => { nodes[nomes[i]] = pl; });
    const prox = rodar('a_proxima_pagina.js', cfg, nodes, `const FILTRO = 'F'; const PROXIMA = ${k}; const PLACES = ${JSON.stringify(nomes)};`).map((i) => i.json);
    if (prox[0] && prox[0].fim) break;
    chamadas += prox.length; places.push(prox.map(() => ({})));
    ondaAnt = prox.map((b) => { const s = sorteia(FATOR); semSite += s; return { ...b, sem_site: s, token: k < 3 ? 'T' : null }; });
  }
  return { chamadas, semSite };
}
const cenarios = {
  'config da branch (15 cidades, paginação desligada)': BASE,
  'paginação ligada (10 cidades, até 3 páginas)': { ...BASE, rotacao: { ...BASE.rotacao, cidadesPorNicho: 10 }, paginacao: { ...BASE.paginacao, paginasMax: 3 } },
};
console.log(`Hipótese: páginas 2-3 rendem ${FATOR} × a página 1; ${RODADAS} rodadas; Out/2026 já tem 26 chamadas usadas (antes de 12/10).`);
for (const [nome, cfg] of Object.entries(cenarios)) {
  const porMes = {};
  for (let r = 0; r < RODADAS; r++) {
    const acc = {};
    for (const iso of segundas) { const m = iso.slice(0, 7); const e = execucao(cfg, iso); acc[m] = acc[m] || { ch: m === '2026-10' ? 26 : 0, ss: 0, max: 0 }; acc[m].ch += e.chamadas; acc[m].ss += e.semSite; acc[m].max = Math.max(acc[m].max, e.chamadas); }
    for (const [m, v] of Object.entries(acc)) { const t = (porMes[m] = porMes[m] || { ch: [], ss: [], max: 0 }); t.ch.push(v.ch); t.ss.push(v.ss); t.max = Math.max(t.max, v.max); }
  }
  console.log(`\n${nome}`);
  for (const [m, t] of Object.entries(porMes)) {
    const med = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const nSeg = segundas.filter((s) => s.startsWith(m)).length;
    console.log(`  ${m} (${nSeg} segundas): chamadas média ${med(t.ch).toFixed(0)}, máx ${Math.max(...t.ch)} de ${cfg.tetoMensalPlaces}`
      + ` · máx por execução ${t.max} de ${cfg.limitePlacesPorExecucao} · PMEs sem site (resultados) média ${med(t.ss).toFixed(0)}`);
  }
}
