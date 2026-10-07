// Paginação do Places (07/10): até CONFIG.paginacao.paginasMax páginas de 20 (= 60 resultados) por busca.
// Prefixo do build: FILTRO (nó "Filtrar…" da onda anterior), PROXIMA (nº da página a pedir) e PLACES (nós de busca já
// existentes, para contar o que a execução gastou). Só pede a próxima página de quem tem nextPageToken e trouxe, na página
// atual, >= minSemSiteParaProximaPagina PMEs sem site operando (busca produtiva), das mais produtivas para as menos, até o
// orçamento da execução (limitePlacesPorExecucao, somando todas as páginas). A cota mensal continua no RPC: cada página
// reserva 1 chamada. Sem página a pedir → 1 item { fim: true } (o fluxo segue para o resumo).
const P = CONFIG.paginacao || { paginasMax: 1, minSemSiteParaProximaPagina: 1 };
const todos = (n) => { try { return $(n).all(); } catch (e) { return []; } };
const usadas = PLACES.reduce((a, n) => a + todos(n).length, 0);
const orcamento = Math.max(0, CONFIG.limitePlacesPorExecucao - usadas);
const anteriores = (todos(FILTRO)[0] || { json: {} }).json.buscas || [];
const proximas = PROXIMA > P.paginasMax ? [] : anteriores
  .filter((b) => b.token && b.sem_site >= P.minSemSiteParaProximaPagina)
  .sort((a, b) => b.sem_site - a.sem_site)
  .slice(0, orcamento);
if (!proximas.length) return [{ json: { fim: true, pagina: PROXIMA, usadas, orcamento, candidatas: anteriores.filter((b) => b.token).length } }];
return proximas.map(({ token, sem_site, resultados, ...b }) => ({ json: { ...b, pagina: PROXIMA, pageToken: token, sem_site_pagina_anterior: sem_site } }));
