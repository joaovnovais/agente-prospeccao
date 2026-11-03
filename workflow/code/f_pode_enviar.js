// LGPD na hora do envio: e-mail do contato OU qualquer contato do lead bloqueado → não envia (registra o motivo).
const bloqueios = $input.all().map((i) => i.json).filter((r) => r && r.email);
const m = $('FU: montar e-mail').first().json;
return [{ json: { ...m, bloqueado: bloqueios.length > 0 } }];
