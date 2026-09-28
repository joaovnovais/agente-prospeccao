// Passo 6→7: decide a ação a partir da qualificação validada.
const v = $('Validar resposta IA - qualificação').first().json;
const ctx = $('Contexto da resposta').first().json;
const q = v.q;
const opcoes = ctx.envio.classificacao_ia?.opcoes_horario || [];
let acao;
if (q.classificacao === 'descadastro') acao = 'optout';
else if (q.classificacao === 'sem_interesse') acao = 'perdido';
else if (q.classificacao === 'fora_do_escopo') acao = 'revisao';
else if (q.escolheu_horario && opcoes[q.escolheu_horario - 1]) acao = 'agendar';
else acao = 'propor';
return [{ json: { acao, q, slot: acao === 'agendar' ? opcoes[q.escolheu_horario - 1] : null,
                  classificacao_patch: { classificacao_ia: { ...ctx.envio.classificacao_ia, qualificacao: q, modelo: v.modelo } } } }];
