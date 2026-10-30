// Fase 1: resultado da variação da vez (28/10: uma por vez, ver b_variacoes.js). "safe" → contato verificado e o lead para
// de gastar crédito; sem confirmação e com variação restante → "proxima" (volta para reservar 1 crédito).
const lead = $('Loop verificação').first().json;
const sd = $getWorkflowStaticData('global');
const execId = String($execution.id);
const st = sd.variacoes && sd.variacoes.exec === execId && sd.variacoes.lead === lead.id
  ? sd.variacoes : { lista: [], idx: 0, verificados: [] };
// Normalmente 1 item (a variação da vez); erro HTTP sem "input" também conta (é inconclusivo). Do "Tem variação?" falso
// chega { email: null }, que não é resultado.
const novos = $input.all().map((i) => i.json).filter((x) => x && (x.input || x.error));
st.verificados.push(...novos);
const res = st.verificados;
const safe = res.find((x) => x.is_reachable === 'safe');
const semCreditos = novos.some((x) => x.sem_creditos === true); // 26/10: Verifalia 402
// Inconclusivo (erro HTTP, timeout, "unknown"): o lead não é marcado como verificado e volta numa próxima execução.
const incompleto = !safe && res.some((x) => x.error || x.is_reachable === 'unknown');
const proxima = !safe && !semCreditos && st.idx + 1 < st.lista.length;
// Disjuntor por LEAD (como antes): só conta quando o lead termina; N leads inconclusivos SEGUIDOS encerram a fase 1.
if (sd.reacherExec !== execId) { sd.reacherExec = execId; sd.reacherFalhas = 0; }
if (!proxima) sd.reacherFalhas = incompleto ? (sd.reacherFalhas || 0) + 1 : 0;
const disjuntor = !proxima && incompleto && sd.reacherFalhas >= CONFIG.reacherFalhasSeguidasMax;
return [{ json: {
  lead,
  safe: !!safe,
  incompleto,
  disjuntor,
  proxima,
  falhasSeguidas: sd.reacherFalhas,
  semCreditos,
  tentativa: res.length,
  email: safe ? String(safe.input).toLowerCase() : null,
  reacher: safe || null,
  verificados: res.map((x) => ({ email: x.input, status: x.is_reachable || 'erro' })),
} }];
