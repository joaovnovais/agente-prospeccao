// Resumo da captação somando as ondas (página 1, 2 e 3). Só PMEs inéditas voltam do upsert (ignore-duplicates).
// ONDAS (prefixo do build): [{ filtro, upsert, places }] por página.
const todos = (n) => { try { return $(n).all(); } catch (e) { return []; } };
const porPagina = ONDAS.map((o, i) => {
  const f = (todos(o.filtro)[0] || { json: {} }).json;
  return { pagina: i + 1, chamadas: todos(o.places).length, sem_site: f.total || 0,
           novos: todos(o.upsert).filter((it) => it.json && it.json.id).length, excluidos: f.excluidos || [], erros: f.erros || [] };
});
return [{ json: {
  leads_novos: porPagina.reduce((a, p) => a + p.novos, 0),
  sem_site_encontrados: porPagina.reduce((a, p) => a + p.sem_site, 0),
  excluidos_lista_manual: porPagina.flatMap((p) => p.excluidos),
  erros_places: porPagina.flatMap((p) => p.erros),
  chamadas_places: porPagina.reduce((a, p) => a + p.chamadas, 0),
  por_pagina: porPagina.map(({ excluidos, erros, ...p }) => p),
} }];
