// Passo 7: e-mail de confirmação (o convite oficial já foi enviado pelo Google Calendar com sendUpdates=all).
const ev = $input.first().json;
const ctx = $('Contexto da resposta').first().json;
const d = $('Decidir próxima ação').first().json;
if (ev.error || !ev.id) {
  return [{ json: { evento_ok: false, erro: String(ev.error?.message || JSON.stringify(ev.error || ev)).slice(0, 300) } }];
}
const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri || '';
const texto = `Perfeito, reunião confirmada para ${d.slot.label}.\n\n` +
  `Acabei de enviar o convite do Google Agenda para este e-mail${meet ? ` — o link da chamada é ${meet}` : ''}. ` +
  'Se precisar remarcar, é só responder por aqui.\n\n' + CONFIG.remetente.assinatura;
return [{ json: { evento_ok: true, destino: ctx.resposta.from, assunto: assuntoResposta(ctx.envio.assunto),
                  texto, html: textoParaHtml(texto), evento: { id: ev.id, meet, label: d.slot.label, inicio: d.slot.inicio } } }];
