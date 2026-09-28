// Lead sem e-mail verificável (nenhum candidato "safe") ou bloqueado pela lista LGPD → sai da fila sem Trello.
const j = $input.first().json;
const bloqueado = j.bloqueado === true;
return [{ json: {
  lead: j.lead,
  lead_patch: bloqueado
    ? { status: 'descartado', motivo_revisao: String(j.motivo || 'bloqueado').slice(0, 500) }
    : { status: 'sem_email', motivo_revisao: (j.verificados ? 'fallback IA: ' + j.verificados.map((v) => `${v.email}=${v.status}`).join(', ') : 'variações do nome falharam e a IA não sugeriu e-mail novo').slice(0, 480) },
  trello_lista: null,
} }];
