// Fase 2: fila do dia. Primeiro quem já tem e-mail confirmado (IA só escreve o texto: 1 chamada = 1 envio);
// depois o fallback (IA sugere e-mails alternativos + texto) com a cota que sobrar.
const lim = $('Calcular limite do dia').first().json;
const com = $('Buscar fila com e-mail').all().map((i) => i.json).filter((l) => l && l.id);
const fb = $('Buscar fila fallback').all().map((i) => i.json).filter((l) => l && l.id);
const vistos = new Set();
const fila = [];
for (const l of com) {
  if (vistos.has(l.id)) continue;
  vistos.add(l.id);
  const { contatos, ...lead } = l;
  const c = (contatos || [])[0];
  // Contato salvo antes de uma regra nova da guarda (ex.: homônimo 06/10) não entra na fila: nem texto, nem fallback.
  if (!emailIdentificaEmpresa(c.email, lead.nome, lead.cidade)) continue;
  fila.push({ ...lead, fila: { modo: 'texto', email: c.email, contato_id: c.id, reacher: c.reacher_raw } });
}
// 09/10: disjuntor aberto nesta execução (Gmail segurando o IP do Reacher) → sem fallback hoje. As sugestões da IA
// também passam pelo Reacher: em 09/10 foram 6 consultas de 45 s depois do disjuntor, insistindo com o IP já travado.
// Quem tem e-mail confirmado (modo texto) continua sendo enviado: não depende do Reacher.
const sd = $getWorkflowStaticData('global');
const disjuntorAberto = sd.reacherExec === String($execution.id) && (sd.reacherFalhas || 0) >= CONFIG.reacherFalhasSeguidasMax;
for (const l of disjuntorAberto ? [] : fb) {
  if (vistos.has(l.id)) continue;
  vistos.add(l.id);
  fila.push({ ...l, fila: { modo: 'fallback' } });
}
let max = lim.lote;
if (CONFIG.modoTeste.dryRun?.ativo) max = Math.min(max, CONFIG.modoTeste.dryRun.maxLeads);
return fila.slice(0, max).map((json) => ({ json }));
