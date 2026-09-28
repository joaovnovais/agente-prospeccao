// Teste: injeta uma resposta simulada no fluxo C (mesmo formato do IMAP "resolved").
const s = CONFIG.modoTeste.respostaSimulada;
if (!s.inReplyTo || !s.from || !s.texto) {
  throw new Error('Defina modoTeste.respostaSimulada {inReplyTo (message_id de um envio de teste), from, texto}.');
}
return [{ json: {
  inReplyTo: s.inReplyTo, references: s.inReplyTo,
  from: { value: [{ address: s.from }] },
  text: s.texto, subject: 'Re: teste', date: agoraISO(),
  messageId: `<simulada-${Date.now()}@teste.local>`,
} }];
