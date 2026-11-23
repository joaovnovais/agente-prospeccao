// 23/11 — bounce (aviso de não entrega, ex. 550 5.1.1 NoSuchUser): o e-mail do contato não existe.
// Marca o contato como inválido e bloqueado (motivo 'bounce'), tira o lead do follow-up (status sem_email),
// sem card no Trello, sem aviso ao João e sem contar como resposta (acao_v1 = 'bounce').
const ctx = $('Contexto da resposta').first().json;
const b = ctx.bounce || {};
const agora = agoraISO();
// Em teste o envio foi para o endereço de redirecionamento: não bloqueia o contato real (a linha só reafirma a origem,
// para o upsert devolver 1 item e o loop seguir).
const rows = ctx.envio.teste ? [{ email: ctx.contato.email, origem: ctx.contato.origem }]
  : [{ email: ctx.contato.email, origem: ctx.contato.origem, reacher_status: 'invalid', bloqueado: true, bloqueado_motivo: 'bounce', bloqueado_em: b.em || agora }];
const dia = String(b.em || agora).slice(0, 10).split('-').reverse().slice(0, 2).join('/');
const motivo = `bounce em ${dia}${b.codigo ? ` (${b.codigo})` : ''}: e-mail inexistente`.slice(0, 480);
// Só sai do funil quem está esperando follow-up; um lead em outro estágio (ex.: respondeu) só ganha o motivo.
const lead_patch = ctx.envio.teste ? { motivo_revisao: `[teste] ${motivo}` }
  : ['novo', 'email_enviado'].includes(ctx.lead.status) ? { status: 'sem_email', motivo_revisao: motivo } : { motivo_revisao: motivo };
return [{ json: { rows, lead: ctx.lead, acao_v1: 'bounce', lead_patch, trello_lista: null } }];
