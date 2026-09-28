// Passo 5 (ramp-up): semana 1 → 5/dia, semana 2 → 10/dia, semana 3+ → 15-20/dia.
// A semana de envio conta a partir do 1º envio REAL (envios de teste não contam).
const s = $input.first().json || {};
if (!CONFIG.modelos.every((m) => m.endsWith(':free'))) {
  throw new Error('Config inválida: todo modelo precisa terminar em ":free".');
}
let semanaEnvio = 1;
if (s.primeiro_envio) semanaEnvio = Math.floor((Date.now() - new Date(s.primeiro_envio).getTime()) / (7 * 864e5)) + 1;
const r = CONFIG.rampUpEnviosPorDia;
let limite = r[Math.min(semanaEnvio, r.length) - 1];
let enviadosHoje = Number(s.total_hoje || 0);

if (CONFIG.modoTeste.ativo) {
  if (!CONFIG.modoTeste.redirecionarPara) {
    throw new Error('Modo teste ativo sem modoTeste.redirecionarPara definido — nenhum e-mail foi enviado.');
  }
  limite = Math.min(limite, CONFIG.modoTeste.limiteEnviosDia);
  enviadosHoje = Number(s.total_hoje_teste || 0);
}
const restante = limite - enviadosHoje;
if (restante <= 0) return [];
// Busca mais leads que o necessário: muitos não terão e-mail verificável. Teto = cota diária de IA.
let lote = Math.min(restante * 3, CONFIG.limiteDiarioOpenRouter);
// Dry-run: testa IA/validação/Reacher em poucos leads, sem SMTP e sem gravar envio.
if (CONFIG.modoTeste.dryRun?.ativo) lote = Math.min(lote, CONFIG.modoTeste.dryRun.maxLeads);
return [{ json: { semanaEnvio, limite, enviadosHoje, restante, lote, loteVerificacao: CONFIG.verificacaoPorExecucao, modoTeste: CONFIG.modoTeste.ativo } }];
