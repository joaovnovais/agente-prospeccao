// Passo 4 (preparo): 1 item por e-mail candidato para o Reacher verificar.
const v = $input.first().json;
return v.candidatos.map((email) => ({ json: { email } }));
