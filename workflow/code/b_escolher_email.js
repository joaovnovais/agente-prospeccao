// Passo 4: só segue com e-mail "safe" no Reacher (descarta invalid/risky/catch-all/unknown).
const v = $('Validar resposta IA - e-mail').first().json;
const res = $input.all().map((i) => i.json);
const verificados = res.map((r) => ({ email: r.input || null, status: r.is_reachable || 'erro' }));
const safe = res.find((r) => r.is_reachable === 'safe' && r.input);
if (!safe) return [{ json: { tem_email: false, lead: v.lead, verificados } }];
return [{ json: { tem_email: true, lead: v.lead, email: String(safe.input).toLowerCase(), reacher: safe,
                  assunto: v.assunto, corpo: v.corpo, verificados } }];
