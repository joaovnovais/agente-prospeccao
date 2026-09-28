// Só PMEs inéditas voltam do upsert (ignore-duplicates).
const f = $('Filtrar sem site + exclusões').first().json;
return [{ json: {
  leads_novos: $input.all().filter((i) => i.json.id).length,
  sem_site_encontrados: f.total,
  excluidos_lista_manual: f.excluidos,
  erros_places: f.erros,
} }];
