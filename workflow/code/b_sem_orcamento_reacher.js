// Orçamento GLOBAL do Reacher esgotado (migration 007, teto diário na função do Supabase): encerra a verificação do dia
// como o disjuntor e marca a execução, para "Montar fila de envio" não rodar o fallback (as sugestões da IA também
// precisariam do Reacher). O lead atual não é marcado como verificado: volta numa próxima execução.
const sd = $getWorkflowStaticData('global');
sd.reacherSemOrcamentoExec = String($execution.id);
const r = $input.first().json || {};
return [{ json: { semOrcamentoReacher: true, usadas: r.usadas ?? null, limite: r.limite ?? null } }];
