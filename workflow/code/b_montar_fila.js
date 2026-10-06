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
for (const l of fb) {
  if (vistos.has(l.id)) continue;
  vistos.add(l.id);
  fila.push({ ...l, fila: { modo: 'fallback' } });
}
let max = lim.lote;
if (CONFIG.modoTeste.dryRun?.ativo) max = Math.min(max, CONFIG.modoTeste.dryRun.maxLeads);
return fila.slice(0, max).map((json) => ({ json }));
