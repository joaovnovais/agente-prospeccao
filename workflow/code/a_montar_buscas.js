// Passo 1 (Robson 2.0, "todo segmento"): 4 nichos do catálogo × 15 cidades (GO+SC) por semana, 1 termo por busca.
// Semana w ocupa as vagas 4w..4w+3; vaga s → nicho s % N (os 4 da semana nunca se repetem) e ocorrência c = floor(s / N).
// Cada ocorrência de um nicho pega a próxima fatia de 15 cidades; 4 fatias cobrem as 56 cidades sem repetir
// nicho×cidade dentro do ciclo (ciclo = 4 ocorrências). O termo alterna a cada ciclo. Teto: limitePlacesPorExecucao.
// (A priorização por taxa de resposta saiu: quebrava a garantia de não repetir combinação.)
const R = CONFIG.rotacao;
const cat = CONFIG.catalogoNichos;
const cidades = R.estados.flatMap((uf) => CONFIG.cidades[uf].map((cidade) => ({ cidade, estado: uf })));
const total = cidades.length;
const fatias = Math.ceil(total / R.cidadesPorNicho);

const inicio = new Date(CONFIG.inicioRotacao + 'T00:00:00' + CONFIG.agenda.fusoOffset);
const semana = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / (7 * 864e5)));

const buscas = [];
for (let k = 0; k < R.nichosPorSemana; k++) {
  const s = semana * R.nichosPorSemana + k;
  const iNicho = s % cat.length;
  const n = cat[iNicho];
  const ocorrencia = Math.floor(s / cat.length);
  const ciclo = Math.floor(ocorrencia / fatias);
  const fatia = ocorrencia % fatias;
  const termo = n.termos[ciclo % n.termos.length];
  // Deslocamento por nicho: nichos diferentes não começam todos pela mesma cidade.
  const base = (iNicho * 7) % total;
  const ini = fatia * R.cidadesPorNicho;
  for (let j = ini; j < Math.min(total, ini + R.cidadesPorNicho); j++) {
    const { cidade, estado } = cidades[(base + j) % total];
    buscas.push({ nicho: n.nicho, estado, cidade, semana_ciclo: fatia + 1, ciclo, semana,
                  textQuery: `${termo} em ${cidade} - ${estado}` });
  }
}
return buscas.slice(0, CONFIG.limitePlacesPorExecucao).map((json) => ({ json }));
