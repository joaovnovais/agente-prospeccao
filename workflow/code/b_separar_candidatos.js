// Passo 4 (preparo): 1 item por e-mail candidato para o Reacher verificar.
// A entrada é a reserva do orçamento do Reacher; os candidatos vêm do validador da IA.
const v = $('Validar resposta IA - e-mail').first().json;
return v.candidatos.map((email) => ({ json: { email } }));
