// E-mail do toque na mesma conversa: "Re: <assunto original>", In-Reply-To/References = 1º e-mail, rodapé LGPD.
// 18/11: sem Message-ID próprio (a Gmail API troca pelo dela); o toque 3 leva o threadId da Novax (do toque 2).
const it = $('FU: loop').first().json;
const v = $('FU: validar texto').first().json;
const teste = it.estagio === 'teste';
const destino = teste ? CONFIG.followup.redirecionarPara : it.contato.email;
const assunto = (teste ? CONFIG.followup.prefixoTeste : '') + assuntoResposta(it.inicial.assunto);
const texto = v.corpo + rodapeLGPD(it.lead);
const html = textoParaHtml(texto);
const raw = emailRaw({ de: `${CONFIG.remetente.nome} <${CONFIG.remetente.email}>`, para: destino, assunto,
  inReplyTo: it.inReplyTo || it.inicial.message_id, references: it.references, texto, html });
// No teste o assunto tem prefixo, então não pode ir para a conversa do lead na caixa da Novax: threadId só fora do teste.
const threadId = teste ? null : (it.threadId || null);
return [{ json: { estagio: it.estagio, destino, email_real: it.contato.email, assunto, texto, corpoIA: v.corpo, raw, threadId, modelo: v.modelo,
  sombra: it.estagio === 'sombra' } }];
