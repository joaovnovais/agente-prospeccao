// Fase 1 (sem IA): variações de e-mail geradas pelo código a partir do nome exato do lead, na ordem da taxa histórica
// de acerto (config.ordemVariacoes). 28/10: a verificação é uma variação por vez e para no 1º e-mail confirmado
// (antes eram todas de uma vez, até 4 créditos por lead mesmo quando a 1ª já confirmava). O estado do lead fica no
// static data da execução; "Variações reservadas" entrega a variação da vez e "Próxima variação" avança.
const lead = $input.first().json;
const vs = variantesEmail(lead.nome, lead.cidade).filter((e) => EMAIL_RE.test(e) && emailPossivel(e));
const sd = $getWorkflowStaticData('global');
sd.variacoes = { exec: String($execution.id), lead: lead.id, lista: vs, idx: 0, verificados: [] };
// Nome longo demais para Gmail → nenhuma variação possível; segue direto p/ o resultado (vira candidato ao fallback da IA).
if (!vs.length) return [{ json: { email: null } }];
return [{ json: { email: vs[0], idx: 0, total: vs.length } }];
