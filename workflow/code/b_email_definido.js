// Ponto único onde o e-mail de destino fica definido, venha ele da fase 1 (variação do nome) ou do fallback da IA.
const v = $('Validar resposta IA - e-mail').first().json;
if (v.lead.fila?.modo === 'texto') {
  return [{ json: { lead: v.lead, email: v.lead.fila.email, reacher: v.lead.fila.reacher || { is_reachable: 'safe' },
                    assunto: v.assunto, corpo: v.corpo, origem: 'codigo_nome' } }];
}
return [{ json: { ...$input.first().json, origem: 'ia_candidato' } }];
