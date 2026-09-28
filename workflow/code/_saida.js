// Formato padrão antes de gravar lead/Trello: {lead, lead_patch, trello_lista, trello_nome, trello_desc, envio?}.
const j = $input.first().json;
if (j.lead_patch) return [{ json: j }];
// Veio de um nó HTTP (ex.: "Bloquear contatos") → recupera o objeto padrão do nó anterior.
return [{ json: $(ORIGEM_FALLBACK).first().json }];
