// Fase 1: consolida o Reacher das variações do nome. "safe" → contato verificado (fila de envio sem gastar IA à toa).
const lead = $('Loop verificação').first().json;
const res = $input.all().map((i) => i.json).filter((r) => r && r.input);
const safe = res.find((r) => r.is_reachable === 'safe');
// Inconclusivo (erro HTTP, timeout SMTP, "unknown"): o Gmail está segurando as consultas deste IP.
// Não marca o lead como verificado — ele volta numa próxima execução — e o disjuntor encerra a fase 1.
const incompleto = !safe && $input.all().some((i) => i.json && (i.json.error || i.json.is_reachable === 'unknown'));
return [{ json: {
  lead,
  safe: !!safe,
  incompleto,
  email: safe ? String(safe.input).toLowerCase() : null,
  reacher: safe || null,
  verificados: res.map((r) => ({ email: r.input, status: r.is_reachable || 'erro' })),
} }];
