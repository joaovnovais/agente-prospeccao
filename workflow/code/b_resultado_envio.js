const m = $('Montar e-mail final').first().json;
const c = $('Upsert contato').first().json;
const r = $input.first().json;
const ok = !!r.messageId && !r.error;
return [{ json: {
  ok,
  lead: m.lead,
  destino: m.destino,
  envio: {
    lead_id: m.lead.id,
    contato_id: c.id,
    tipo: 'prospeccao',
    assunto: m.assunto,
    corpo: m.texto,
    message_id: r.messageId || null,
    status: ok ? 'enviado' : 'erro',
    erro: ok ? null : String(r.error?.message || JSON.stringify(r.error || r)).slice(0, 500),
    teste: m.teste,
  },
  lead_patch: ok ? { status: 'email_enviado' } : { status: 'revisao_manual', motivo_revisao: 'falha no envio SMTP' },
  trello_lista: ok ? CONFIG.trello.emailEnviado : CONFIG.trello.revisaoManual,
  trello_nome: (m.teste ? '[TESTE] ' : '') + `${m.lead.nome} — ${m.lead.cidade}/${m.lead.estado}`,
  trello_desc: [
    `**Nicho:** ${m.lead.nicho}`,
    `**E-mail:** ${m.email_real}${m.teste ? ' (TESTE: enviado para ' + m.destino + ')' : ''}`,
    `**Telefone:** ${m.lead.telefone || '-'}`,
    `**Endereço:** ${m.lead.endereco || '-'}`,
    `**Google Maps:** ${m.lead.google_maps_url || '-'}`,
    `**Nota:** ${m.lead.rating ?? '-'} (${m.lead.total_avaliacoes ?? 0} avaliações)`,
    '', `**Assunto enviado:** ${m.assunto}`, '', m.texto,
  ].join('\n'),
} }];
