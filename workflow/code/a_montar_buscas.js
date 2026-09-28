// Passo 1: define nicho + estado da semana (rotação de 4) e monta 1 busca por cidade × termo.
// Entrada: linhas de prospeccao_taxa_resposta (ou 1 item vazio).
const taxa = $input.all().map((i) => i.json).filter((r) => r && r.nicho);

const inicio = new Date(CONFIG.inicioRotacao + 'T00:00:00' + CONFIG.agenda.fusoOffset);
const semanas = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / (7 * 864e5)));
const slot = semanas % CONFIG.rotacao.length;
const ciclo = Math.floor(semanas / CONFIG.rotacao.length);
const r = CONFIG.rotacao[slot];
const lista = CONFIG.cidades[r.estado];
const n = CONFIG.cidadesPorSemana;

// Cada ciclo avança n cidades na lista do estado -> cobertura progressiva do estado inteiro.
let cidades = [];
for (let k = 0; k < n; k++) cidades.push(lista[(r.offset + ciclo * n + k) % lista.length]);

// Semana 5+: nicho×cidade com melhor taxa de resposta observada entra primeiro.
if (ciclo >= 1) {
  const melhores = taxa
    .filter((t) => t.nicho === r.nicho && t.estado === r.estado && Number(t.taxa_resposta_pct) > 0)
    .sort((a, b) => Number(b.taxa_resposta_pct) - Number(a.taxa_resposta_pct))
    .slice(0, 2).map((t) => t.cidade);
  cidades = [...new Set([...melhores, ...cidades])].slice(0, n);
}

const buscas = [];
for (const cidade of cidades) {
  for (const termo of r.buscas) {
    buscas.push({ nicho: r.nicho, estado: r.estado, cidade, semana_ciclo: slot + 1, ciclo,
                  textQuery: `${termo} em ${cidade} - ${r.estado}` });
  }
}
return buscas.slice(0, CONFIG.limitePlacesPorExecucao).map((json) => ({ json }));
