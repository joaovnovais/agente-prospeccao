// Orçamento do Reacher reservado (migration 007): devolve as variações do nome com e-mail para o Reacher consultar.
return $('Variações do nome').all().filter((i) => i.json && i.json.email).map((i) => ({ json: i.json }));
