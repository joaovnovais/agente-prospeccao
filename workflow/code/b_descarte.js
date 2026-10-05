// Lead sem e-mail verificável (nenhum candidato "safe") ou bloqueado pela lista LGPD → sai da fila sem Trello.
const j = $input.first().json;
const bloqueado = j.bloqueado === true;
// Auditoria H3: todos os candidatos "unknown"/erro = inconclusivo (Gmail segurando o IP), não "não tem e-mail".
// Volta o lead para a fila (até maxTentativasFallback); só depois disso vira sem_email.
const vs = j.verificados || [];
const inconclusivo = !bloqueado && vs.length > 0 && vs.every((v) => v.status !== 'invalid' && v.status !== 'safe');
const tentativa = (j.lead.tentativas_fallback || 0) + 1;
if (inconclusivo && tentativa < CONFIG.maxTentativasFallback) {
  return [{ json: { lead: j.lead, trello_lista: null, lead_patch: { status: 'novo', tentativas_fallback: tentativa,
    motivo_revisao: `fallback inconclusivo (tentativa ${tentativa}): ` + vs.map((v) => `${v.email}=${v.status}`).join(', ').slice(0, 400) } } }];
}
return [{ json: {
  lead: j.lead,
  lead_patch: bloqueado
    ? { status: 'descartado', motivo_revisao: String(j.motivo || 'bloqueado').slice(0, 500) }
    : { status: 'sem_email', motivo_revisao: (j.verificados ? 'fallback IA: ' + j.verificados.map((v) => `${v.email}=${v.status}`).join(', ') : 'variações do nome falharam e a IA não sugeriu e-mail novo').slice(0, 480) },
  trello_lista: null,
} }];
