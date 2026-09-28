// Gera um relatório legível (Markdown) de uma execução de dry-run do n8n:
// por lead → cada tentativa da IA (bruta se rejeitada), verificação Reacher e o e-mail final como seria enviado.
// Uso: node relatorio-dryrun.mjs <execucao.json> <saida.md> "<título da rodada>"
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , entrada, saida, titulo = 'Dry-run'] = process.argv;
const txt = readFileSync(entrada, 'utf8');
const exec = JSON.parse(txt.slice(txt.indexOf('{')));
const run = exec.data.resultData.runData;
const saidas = (no) => (run[no] || []).map((r) => (r.data?.main || []).flat().map((i) => i.json));
const CONFIG = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));

const leads = new Map();
const doLead = (lead) => {
  if (!leads.has(lead.id)) leads.set(lead.id, { lead, tentativas: [], fase1: null, verificados: null, final: null, desfecho: null, definido: null });
  return leads.get(lead.id);
};
const fase1 = saidas('Resultado verificação (código)').flat();
for (const r of fase1) doLead(r.lead).fase1 = r;
const fila = saidas('Montar fila de envio').flat();
for (const r of saidas('Validar resposta IA - e-mail').flat()) doLead(r.lead).tentativas.push(r);
for (const r of saidas('E-mail definido').flat()) doLead(r.lead).definido = r;
for (const r of saidas('Escolher melhor e-mail').flat()) Object.assign(doLead(r.lead), { verificados: r.verificados, escolhido: r.email || null });
for (const r of saidas('Montar e-mail final').flat()) doLead(r.lead).final = r;
for (const r of saidas('Saída (B)').flat()) doLead(r.lead).desfecho = r.lead_patch;

const rodape = (lead) => `\n\n${CONFIG.remetente.assinatura}\n\n—\nVocê recebeu esta mensagem porque ${lead.nome} aparece como empresa no Google Maps em ${lead.cidade}/${lead.estado}. ` +
  'Se não quiser receber novos contatos da Novax, responda com a palavra SAIR e removemos seu e-mail imediatamente.';

const L = [];
L.push(`# ${titulo}`, '');
L.push(`- Execução: ${exec.startedAt} → status **${exec.status}**`);
L.push(`- Modelos: ${CONFIG.modelos.join(' → fallback ')}`);
L.push(`- Malformação forçada na tentativa: ${CONFIG.modoTeste.forcarRespostaMalformadaNaTentativa || 'nenhuma'}`);
L.push(CONFIG.modoTeste.dryRun?.ativo ? '- **Nenhum e-mail foi enviado** (dry-run para antes do SMTP).' : `- Envio real ${CONFIG.modoTeste.ativo ? 'REDIRECIONADO para ' + CONFIG.modoTeste.redirecionarPara : 'para os prospects'}.`, '');
if (exec.data.resultData.error) L.push(`> ⚠ Erro na execução: ${exec.data.resultData.error.message}`, '');

if (fase1.length) {
  const ok = fase1.filter((r) => r.safe).length;
  L.push('## Fase 1 — variações do nome no Reacher (sem IA)', '');
  L.push(`${fase1.length} leads verificados · **${ok} com e-mail confirmado** · ${fase1.filter((r) => r.incompleto).length} com erro do Reacher (tentam de novo depois)`, '');
  for (const r of fase1) L.push(`- ${r.lead.nome} (${r.lead.cidade}): ${r.safe ? '✅ ' + r.email : r.verificados.length ? '❌ ' + r.verificados.map((v) => `${v.email}=${v.status}`).join(', ') : '— nome longo demais p/ Gmail, vai p/ fallback'}`);
  L.push('');
}
if (fila.length) L.push(`## Fase 2 — fila de envio`, '', `${fila.length} leads na fila: ${fila.filter((l) => l.fila?.modo === 'texto').length} com e-mail confirmado (IA só escreve o texto) + ${fila.filter((l) => l.fila?.modo !== 'texto').length} no fallback (IA sugere e-mails).`, '');

let n = 0;
for (const x of [...leads.values()].filter((v) => v.tentativas.length)) {
  n++;
  const { lead } = x;
  L.push('---', '', `## ${n}. ${lead.nome} — ${lead.cidade}/${lead.estado}`, '');
  L.push(`Nicho: ${lead.nicho} · Nota ${lead.rating ?? '-'} (${lead.total_avaliacoes ?? 0} avaliações) · ${lead.google_maps_url || ''}`, '');
  L.push(`Modo: **${x.lead.fila?.modo === 'texto' ? 'e-mail já confirmado na fase 1 (' + x.lead.fila.email + ')' : 'fallback — IA sugere e-mails'}**`, '');
  L.push('### Tentativas da IA', '');
  for (const t of x.tentativas) {
    if (t.ok) L.push(`- Tentativa ${t.tentativa}: ✅ JSON válido (modelo: ${t.modelo || '-'})`);
    else {
      L.push(`- Tentativa ${t.tentativa}: ❌ rejeitada — ${t.erro}`);
      if (t.raw) L.push('', '  <details><summary>saída bruta rejeitada</summary>', '', '  ```', ...String(t.raw).split('\n').map((l) => '  ' + l), '  ```', '  </details>', '');
    }
  }
  const ok = x.tentativas.find((t) => t.ok);
  L.push('');
  if (x.verificados) {
    L.push('### E-mails candidatos (Reacher)', '');
    for (const v of x.verificados) L.push(`- ${v.email} → **${v.status}**${v.email === x.escolhido ? ' ← escolhido' : ''}`);
    L.push('');
  }
  if (ok) {
    L.push('### E-mail gerado (como seria enviado)', '');
    L.push(`**Assunto:** ${ok.assunto}`, '');
    const corpo = x.final ? x.final.texto : ok.corpo + rodape(lead);
    L.push('```text', corpo, '```', '');
    if (!x.final && !x.definido) L.push('_Obs.: nenhum candidato "safe" no Reacher — na operação real este lead NÃO receberia e-mail (vira sem_email)._', '');
  }
  L.push(`**Desfecho no dry-run:** ${x.desfecho ? JSON.stringify(x.desfecho) : 'voltou para a fila (status "novo")'}`, '');
}
if (!n) L.push('_Nenhum lead processado nesta execução._');

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, L.join('\n'));
console.log(`relatório: ${saida} (${n} leads)`);
