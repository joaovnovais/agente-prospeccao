// Resposta de lead caiu em revisão manual → e-mail curto ao João (nunca ao lead) com empresa, cidade, motivo e link do card.
if (!CONFIG.alertaDestino) throw new Error('config.alertaDestino vazio: aviso de revisão sem destinatário.');
const s = $('Saída (C)').first().json;
// Link do card: resposta do Trello (criar ou mover) cujo id é o que acabou de ser salvo no lead — no loop de respostas,
// o outro nó do Trello pode ter rodado numa resposta anterior. Sem a resposta do Trello, o link sai do id salvo.
const doNo = (n) => { try { return $(n).first().json || {}; } catch (e) { return {}; } };
const id = doNo('Salvar card no lead (C)').trello_card_id || s.lead.trello_card_id;
const card = [doNo('Trello - criar card (C)'), doNo('Trello - mover card (C)')].find((c) => id && c.id === id && (c.shortUrl || c.url)) || {};
const link = card.shortUrl || card.url || (id ? `https://trello.com/c/${id}` : 'card não criado no Trello (ver lista Revisão manual)');
const motivo = String(s.lead_patch?.motivo_revisao || '-');
const texto = [
  `Empresa: ${s.lead.nome}`,
  `Cidade: ${s.lead.cidade}/${s.lead.estado}`,
  `Motivo: ${motivo}`,
  `Card: ${link}`,
].join('\n');
return [{ json: { destino: CONFIG.alertaDestino, assunto: '[Robson] Lead respondeu — revisão manual', texto, html: textoParaHtml(texto), link } }];
