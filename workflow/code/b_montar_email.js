// LGPD: consulta a lista de bloqueio (e-mail escolhido OU qualquer contato do mesmo lead) antes de enviar.
const bloqueios = $input.all().map((i) => i.json).filter((r) => r && r.email);
const e = $('E-mail definido').first().json;
if (bloqueios.length) return [{ json: { bloqueado: true, lead: e.lead, motivo: 'bloqueado: ' + bloqueios.map((b) => b.email).join(', ') } }];

const teste = CONFIG.modoTeste.ativo;
const destino = teste ? CONFIG.modoTeste.redirecionarPara : e.email;
const assunto = (teste ? `[TESTE → ${e.email}] ` : '') + e.assunto;
const texto = e.corpo + rodapeLGPD(e.lead);
return [{ json: { bloqueado: false, lead: e.lead, email_real: e.email, reacher: e.reacher, origem: e.origem,
                  destino, assunto, texto, html: textoParaHtml(texto), teste } }];
