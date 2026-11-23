// Formato padrão antes de gravar lead/Trello: {lead, lead_patch, trello_lista, trello_nome, trello_desc, envio?}.
const j = $input.first().json;
if (j.lead_patch) return [{ json: j }];
// Veio de um nó HTTP (ex.: "Bloquear contatos", "Marcar bounce") → recupera o objeto padrão do nó anterior.
// ORIGEM_FALLBACK pode ser um nome ou uma lista (ramo C: "Dados bloqueio" ou "Dados bounce"); vale o que rodou.
for (const o of [].concat(ORIGEM_FALLBACK)) {
  let x = null;
  try { x = $(o).first(); } catch (e) { x = null; }
  if (x && x.json && x.json.lead_patch) return [{ json: x.json }];
}
throw new Error('Saída: nenhum nó de origem rodou (' + [].concat(ORIGEM_FALLBACK).join(', ') + ')');
