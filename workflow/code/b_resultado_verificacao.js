// Fase 1: consolida o Reacher das variações do nome. "safe" → contato verificado (fila de envio sem gastar IA à toa).
const lead = $('Loop verificação').first().json;
const res = $input.all().map((i) => i.json).filter((r) => r && r.input);
const safe = res.find((r) => r.is_reachable === 'safe');
// Inconclusivo (erro HTTP, timeout SMTP, "unknown"): pode ser o Gmail segurando as consultas deste IP, ou só este lead.
// Não marca o lead como verificado — ele volta numa próxima execução, no fim da fila (o PATCH renova updated_at).
const incompleto = !safe && $input.all().some((i) => i.json && (i.json.error || i.json.is_reachable === 'unknown'));
// Disjuntor: um lead inconclusivo isolado é pulado; só encerra a fase 1 após N inconclusivos SEGUIDOS
// (aí o problema é sistêmico — rate limit do IP — e insistir só pioraria). Contador por execução.
const sd = $getWorkflowStaticData('global');
const execId = String($execution.id);
if (sd.reacherExec !== execId) { sd.reacherExec = execId; sd.reacherFalhas = 0; }
sd.reacherFalhas = incompleto ? (sd.reacherFalhas || 0) + 1 : 0;
const disjuntor = incompleto && sd.reacherFalhas >= CONFIG.reacherFalhasSeguidasMax;
return [{ json: {
  lead,
  safe: !!safe,
  incompleto,
  disjuntor,
  falhasSeguidas: sd.reacherFalhas,
  email: safe ? String(safe.input).toLowerCase() : null,
  reacher: safe || null,
  verificados: res.map((r) => ({ email: r.input, status: r.is_reachable || 'erro' })),
} }];
