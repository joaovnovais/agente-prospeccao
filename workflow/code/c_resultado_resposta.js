// Resultado do envio de uma resposta (proposta de horários OU confirmação de reunião) → formato padrão da "Saída (C)".
const ctx = $('Contexto da resposta').first().json;
const d = $('Decidir próxima ação').first().json;
const r = $input.first().json;
// MODO é injetado pelo build.mjs: 'confirmacao' ou 'proposta' (um Code node por caminho).
const confirmacao = MODO === 'confirmacao';
const m = confirmacao ? $('Montar confirmação').first().json : $('Montar proposta de horários').first().json;
const ok = !!r.messageId && !r.error;
const nome = `${ctx.lead.nome} — ${ctx.lead.cidade}/${ctx.lead.estado}`;
return [{ json: {
  lead: ctx.lead,
  envio: {
    lead_id: ctx.lead.id, contato_id: ctx.contato.id,
    tipo: confirmacao ? 'convite_reuniao' : 'proposta_reuniao',
    assunto: m.assunto, corpo: m.texto, message_id: r.messageId || null,
    status: ok ? 'enviado' : 'erro',
    erro: ok ? null : String(r.error?.message || JSON.stringify(r.error || r)).slice(0, 500),
    teste: !!ctx.envio.teste,
    classificacao_ia: confirmacao ? { evento: m.evento } : { opcoes_horario: m.opcoes },
  },
  lead_patch: !ok ? { status: 'revisao_manual', motivo_revisao: 'falha no envio SMTP da resposta' }
            : confirmacao ? { status: 'reuniao_agendada' } : { status: 'respondeu' },
  trello_lista: !ok ? CONFIG.trello.revisaoManual : confirmacao ? CONFIG.trello.reuniaoAgendada : CONFIG.trello.respondeu,
  trello_nome: nome,
  trello_desc: confirmacao
    ? `**Reunião:** ${m.evento.label}\n**Meet:** ${m.evento.meet || '-'}\n**Resumo da resposta:** ${d.q.resumo}`
    : `**Resumo da resposta:** ${d.q.resumo}\n**Horários propostos:** ${m.opcoes.map((o) => o.label).join(' | ') || 'pediu disponibilidade'}`,
} }];
