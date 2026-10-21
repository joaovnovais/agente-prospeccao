// Troca de modelo (21/10): modelos pagos, data_collection "deny" em toda chamada e teto de gasto no lugar da trava ":free".
// Offline. Uso: node workflow/tests/troca-modelo.test.mjs
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const gasto = (cfg) => new Function('CONFIG', LIB + '; return gastoMaximoMensalIA(CONFIG);')(cfg);
const limiteDia = (cfg) => new Function('$input', '$', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/b_limite_dia.js`, 'utf8'))(
  { first: () => ({ json: { primeiro_envio: '2026-09-29T12:31:52.982Z', total_hoje: 0, total_hoje_teste: 0 } }) }, () => ({ first: () => ({ json: {} }) }), cfg);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Config');
ok(JSON.stringify(CONFIG.modelos) === JSON.stringify(['openai/gpt-5.6-luna', 'openai/gpt-6-luna']), 'principal gpt-5.6-luna, reserva gpt-6-luna');
ok(!CONFIG.modelos.some((m) => m.endsWith(':free')), 'nenhum modelo :free');
ok(CONFIG.tetoGastoIAMensalUSD === 2 && CONFIG.maxTokensIA === 1000, 'teto US$ 2/mês e max_tokens 1000');

console.log('Teto de gasto (no lugar da trava ":free")');
const g = gasto(CONFIG);
ok(g.ok && g.usd <= 2, `config atual cabe: pior caso US$ ${g.usd}/mês (45 chamadas/dia × 23 dias, entrada ${CONFIG.tokensEntradaMaxIA}, saída ${CONFIG.maxTokensIA})`);
ok(!gasto({ ...CONFIG, modelos: [...CONFIG.modelos, 'vendor/modelo-sem-preco'] }).ok, 'modelo sem preço declarado → recusado');
ok(!gasto({ ...CONFIG, modelos: ['nvidia/nemotron-3-super-120b-a12b:free'] }).ok, 'modelo :free sem preço → recusado (não volta por engano)');
ok(!gasto({ ...CONFIG, modelos: ['caro/x'], precosIA: { 'caro/x': [1.5, 9] } }).ok, 'modelo caro (ex.: US$ 1,50/9 por M) estoura o teto → recusado');
ok(!gasto({ ...CONFIG, limiteDiarioOpenRouter: 100 }).ok, 'teto diário de chamadas alto demais → recusado');
let erro = null; try { limiteDia({ ...CONFIG, modelos: ['vendor/sem-preco'] }); } catch (e) { erro = e.message; }
ok(/Config inválida: modelo sem preço/.test(erro || ''), '"Calcular limite do dia" para a execução com config inválida');
ok(limiteDia(CONFIG)[0].json.limite > 0, '"Calcular limite do dia" roda com a config atual');

console.log('Chamadas à OpenRouter no workflow');
const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
const or = w.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest' && String(n.parameters.url).includes('openrouter.ai'));
ok(or.length === 2, `2 nós chamam a OpenRouter (${or.map((n) => n.name).join(', ')})`);
for (const n of or) {
  const b = n.parameters.jsonBody;
  ok(b.includes(`provider: { data_collection: 'deny' }`), `"${n.name}": provider.data_collection = "deny"`);
  ok(b.includes('models: ["openai/gpt-5.6-luna","openai/gpt-6-luna"]') && !b.includes(':free'), `"${n.name}": models = principal + reserva, sem :free`);
  ok(b.includes('max_tokens: 1000'), `"${n.name}": max_tokens 1000`);
}
ok(!JSON.stringify(w).includes(':free"'), 'nenhum ":free" em lugar nenhum do workflow');

console.log('Build recusa config inválida');
{
  const d = mkdtempSync(join(tmpdir(), 'prsp-modelo-'));
  cpSync(R, d, { recursive: true, filter: (s) => !s.includes('dist') });
  const c = JSON.parse(readFileSync(join(d, 'config.json'), 'utf8')); c.modelos = ['qwen/qwen3.8-27b:free'];
  writeFileSync(join(d, 'config.json'), JSON.stringify(c));
  let falhou = false; try { execFileSync(process.execPath, [join(d, 'build.mjs')], { stdio: 'pipe' }); } catch { falhou = true; }
  rmSync(d, { recursive: true, force: true });
  ok(falhou, 'build com modelo :free (sem preço) não gera o workflow');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
