// E-mail do toque na mesma conversa: "Re: <assunto original>", In-Reply-To/References do toque anterior, rodapé LGPD.
const it = $('FU: loop').first().json;
const v = $('FU: validar texto').first().json;
const teste = it.estagio === 'teste';
const destino = teste ? CONFIG.followup.redirecionarPara : it.contato.email;
const assunto = (teste ? CONFIG.followup.prefixoTeste : '') + assuntoResposta(it.inicial.assunto);
const texto = v.corpo + rodapeLGPD(it.lead);
const html = textoParaHtml(texto);
const messageId = `<${uuidV4()}@gmail.com>`;
const raw = emailRaw({ de: `${CONFIG.remetente.nome} <${CONFIG.remetente.email}>`, para: destino, assunto,
  inReplyTo: it.pai.message_id, references: it.references, messageId, texto, html });
return [{ json: { estagio: it.estagio, destino, email_real: it.contato.email, assunto, texto, corpoIA: v.corpo, messageId, raw, modelo: v.modelo,
  sombra: it.estagio === 'sombra' } }];
