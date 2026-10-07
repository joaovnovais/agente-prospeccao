// LGPD: descadastro ou "sem interesse" → e-mail entra na lista de bloqueio (nunca mais é contatado).
const ctx = $('Contexto da resposta').first().json;
const acao = $input.first().json.acao || 'optout';
const motivo = acao === 'perdido' ? 'sem_interesse' : 'descadastro';
const agora = agoraISO();
const rows = [{ email: ctx.contato.email, origem: ctx.contato.origem, bloqueado: true, bloqueado_motivo: motivo, bloqueado_em: agora }];
// Quem respondeu (se for outro endereço) também entra — exceto em teste, onde é o endereço de redirecionamento.
if (!ctx.envio.teste && ctx.resposta.from && ctx.resposta.from !== ctx.contato.email) {
  rows.push({ email: ctx.resposta.from, origem: 'resposta', bloqueado: true, bloqueado_motivo: motivo, bloqueado_em: agora });
}
return [{ json: {
  rows,
  lead: ctx.lead,
  acao_v1: motivo === 'sem_interesse' ? 'sem_interesse' : 'optout',
  lead_patch: { status: 'perdido' },
  trello_lista: CONFIG.trello.fechadoPerdido,
  trello_nome: `${ctx.lead.nome} — ${ctx.lead.cidade}/${ctx.lead.estado}`,
  trello_desc: `**Encerrado:** ${motivo}\n\n**Resposta:**\n${ctx.resposta.texto}`,
} }];
