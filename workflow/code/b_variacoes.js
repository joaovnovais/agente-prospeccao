// Fase 1 (sem IA): variações de e-mail geradas pelo código a partir do nome exato do lead.
const lead = $input.first().json;
const vs = variantesEmail(lead.nome, lead.cidade).filter((e) => EMAIL_RE.test(e) && emailPossivel(e));
// Nome longo demais para Gmail → nenhuma variação possível; segue direto p/ o resultado (vira candidato ao fallback da IA).
if (!vs.length) return [{ json: { email: null } }];
return vs.map((email) => ({ json: { email } }));
