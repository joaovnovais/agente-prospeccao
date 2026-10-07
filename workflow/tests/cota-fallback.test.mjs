// Cota da IA no fallback (13/10): (a) sem candidato não gera nova tentativa, (b) assunto "Presença digital para" corrigido
// em código + prompt alinhado ao validador, (c) teto diário de chamadas do fallback (na ordem antiga da fila).
// Dados FICTÍCIOS (o repositório é público). Offline. Uso: node workflow/tests/cota-fallback.test.mjs
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { variantesEmail, assuntoPadrao, ASSUNTO_SITE_EXISTE_RE, checarFatos };')(CONFIG);
const rodar = (file, { input = [], nodes = {}, staticData = {}, config = CONFIG } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, config);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

const lead = (modo, extra = {}) => ({ id: 'L1', nome: 'Advocacia Vasconcelos Exemplar', cidade: 'Vila Fictícia', estado: 'GO', rating: 4.8,
  total_avaliacoes: 52, tipo_google: 'Advogado', tipos_google: ['lawyer'], nicho: 'advocacia', fila: { modo }, ...extra });
const CORPO = 'Olá! Vi que a Advocacia Vasconcelos Exemplar, em Vila Fictícia/GO, tem nota 4,8 com 52 avaliações no Google, mas não possui site '
  + 'vinculado ao perfil. Quem pesquisa pelo escritório no Google não encontra as áreas de atuação nem um canal direto para agendar uma consulta. '
  + 'Um site simples resolveria essa lacuna, reunindo informações, endereço e um botão de contato. Posso mostrar como isso funcionaria em uma '
  + 'reunião de diagnóstico gratuita de 30 minutos, online?';
const ASSUNTO = 'Advocacia Vasconcelos Exemplar em Vila Fictícia: o que o Google mostra';
const CAND = 'contato.vasconcelosexemplar@gmail.com';
const validar = (l, obj, tentativa = 1) => rodar('b_validar_ia.js', {
  input: [{ json: { model: 'teste', choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }] } }],
  nodes: { 'Pedido IA - e-mail': [{ json: { lead: l, tentativa, messages: [] } }] },
})[0].json;

console.log('Pré-condições dos dados fictícios');
ok(!lib.variantesEmail(lead('fallback').nome, 'Vila Fictícia').includes(CAND), 'candidato fictício não é variação já testada');
ok(validar(lead('texto'), { assunto: ASSUNTO, corpo: CORPO }).ok === true, 'texto de referência passa no validador');

console.log('(a) fallback sem candidato aproveitável não gera nova tentativa');
{
  const v = validar(lead('fallback'), { candidatos_email: [], assunto: ASSUNTO, corpo: CORPO.replace('Um site simples', 'Um site excelente') });
  ok(v.ok === true && v.sem_candidato === true && v.candidatos.length === 0, 'lista vazia + texto reprovável → ok sem candidato (vai para o descarte, sem retry)');
  const v2 = validar(lead('fallback'), { assunto: 'x', corpo: 'curto' });
  ok(v2.ok === true && v2.sem_candidato === true, 'sem "candidatos_email" + texto inválido → ok sem candidato');
  const v3 = validar(lead('fallback'), { candidatos_email: ['fulano@gmail.com', 'outro@hotmail.com', lib.variantesEmail(lead().nome, 'Vila Fictícia')[0]], assunto: ASSUNTO, corpo: 'curto' });
  ok(v3.ok === true && v3.sem_candidato === true, 'só candidatos filtrados (homônimo, provedor, variação já testada) → ok sem candidato');
  const v4 = validar(lead('fallback'), { candidatos_email: [CAND], assunto: ASSUNTO, corpo: CORPO.replace('Um site simples', 'Um site excelente') });
  ok(v4.ok === false && /excelente/.test(v4.erro), 'com candidato aproveitável e texto reprovado → continua indo para nova tentativa');
  const v5 = validar(lead('fallback'), { candidatos_email: [CAND], assunto: ASSUNTO, corpo: CORPO });
  ok(v5.ok === true && v5.candidatos[0] === CAND && !v5.sem_candidato, 'com candidato e texto bom → segue para o Reacher');
  const v6 = validar(lead('texto'), { assunto: ASSUNTO, corpo: CORPO.replace('Um site simples', 'Um site excelente') });
  ok(v6.ok === false, 'modo texto (e-mail confirmado) com texto reprovado → nova tentativa, como antes');
  const d = rodar('b_descarte.js', { input: [{ json: v }] })[0].json;
  ok(d.lead_patch.status === 'sem_email' && /não sugeriu e-mail novo/.test(d.lead_patch.motivo_revisao), 'descarte grava sem_email com o motivo de sempre');
  const vJson = rodar('b_validar_ia.js', { input: [{ json: { choices: [{ message: { content: 'não é JSON' }, finish_reason: 'stop' }] } }],
    nodes: { 'Pedido IA - e-mail': [{ json: { lead: lead('fallback'), tentativa: 1, messages: [] } }] } })[0].json;
  ok(vJson.ok === false, 'resposta que não é JSON continua indo para nova tentativa (não dá para saber os candidatos)');
}

console.log('(b) assunto "Presença digital para" corrigido sem nova chamada + prompt alinhado');
{
  const v = validar(lead('texto'), { assunto: 'Presença digital para Advocacia Vasconcelos Exemplar', corpo: CORPO });
  ok(v.ok === true && v.assunto_corrigido === true && v.assunto === 'Advocacia Vasconcelos Exemplar em Vila Fictícia: perfil no Google sem site',
     'assunto trocado pelo padrão (nome + cidade) e aprovado');
  ok(validar(lead('texto'), { assunto: ASSUNTO, corpo: CORPO }).assunto_corrigido === false, 'assunto normal não é tocado');
  const v2 = validar(lead('texto'), { assunto: 'presenca digital para voces', corpo: CORPO.replace('Um site simples', 'Um site excelente') });
  ok(v2.ok === false && !/Presença digital/.test(v2.erro) && /excelente/.test(v2.erro), 'outros erros continuam valendo depois da correção');
  const longo = lib.assuntoPadrao({ nome: 'Sociedade de Advogados Exemplar Fictício Vasconcelos Albuquerque e Associados', cidade: 'Vila Fictícia do Norte' });
  ok(longo.length <= 90 && longo.length >= 5, `nome longo cabe em 90 caracteres (${longo.length})`);
  ok(!lib.ASSUNTO_SITE_EXISTE_RE.test(lib.assuntoPadrao(lead())), 'assunto padrão não sugere que a empresa já tem site');
  const sd = {};
  const p = rodar('b_pedido_ia.js', { input: [{ json: { lead: lead('texto') } }], staticData: sd })[0].json.messages[0].content;
  for (const w of ['bem avaliada', 'boa avaliação', 'reputação', 'nota alta']) ok(p.includes(`"${w}"`), `prompt proíbe "${w}"`);
  ok((p.match(/\{empresa\}/g) || []).length >= 3 && /NUNCA comece com "Presença digital para"/.test(p), 'prompt traz 3 modelos de assunto');
}

console.log(`(c) teto diário do fallback (${CONFIG.maxChamadasFallbackDia}), ordem da fila inalterada`);
{
  ok(CONFIG.maxChamadasFallbackDia === 15, 'config: maxChamadasFallbackDia = 15');
  const sd = {};
  const pedir = (l, extra = {}) => rodar('b_pedido_ia.js', { input: [{ json: { lead: l, ...extra } }], staticData: sd })[0].json;
  const res = Array.from({ length: 15 }, () => pedir(lead('fallback')));
  ok(res.every((r) => !r.teto_fallback && r.messages), '15 chamadas de fallback liberadas');
  ok(pedir(lead('fallback')).teto_fallback === true, '16ª chamada de fallback barrada');
  ok(pedir(lead('fallback'), { tentativa: 2, messages: [{ role: 'user', content: 'x' }] }).teto_fallback === true, 'nova tentativa de fallback também conta e é barrada');
  ok(!pedir(lead('texto')).teto_fallback, 'modo texto (e-mail confirmado) nunca é barrado pelo teto');
  ok(sd.fallbackDia.chamadas === 15, 'modo texto não conta no teto');
  sd.fallbackDia.dia = '2000-01-01';
  ok(!pedir(lead('fallback')).teto_fallback && sd.fallbackDia.chamadas === 1, 'novo dia zera o contador');
  const sd2 = {};
  rodar('b_pedido_ia.js', { input: [{ json: { lead: lead('fallback'), tentativa: 2, messages: [{ role: 'user', content: 'x' }] } }], staticData: sd2 });
  ok(sd2.fallbackDia.chamadas === 1, 'nova tentativa conta 1 chamada');

  const fl = (id, aval, comEmail = false) => ({ id, nome: `Exemplo ${id}`, cidade: 'Vila Fictícia', total_avaliacoes: aval,
    ...(comEmail ? { contatos: [{ id: 'c' + id, email: `exemplo${id}fict@exemplo.com.br`, reacher_raw: {} }] } : {}) });
  const fila = rodar('b_montar_fila.js', { nodes: {
    'Calcular limite do dia': [{ json: { lote: 30 } }],
    'Buscar fila com e-mail': [{ json: fl('t1', 3, true) }],
    'Buscar fila fallback': [fl('t1', 3), fl('a', 12), fl('b', 234), fl('c', null), fl('d', 78)].map((json) => ({ json })) } }).map((i) => i.json);
  ok(fila[0].id === 't1' && fila[0].fila.modo === 'texto', 'e-mail confirmado continua primeiro, mesmo com poucas avaliações');
  // 07/10: prioridade por avaliações revertida (90 leads sem relação entre avaliações e e-mail safe; o replay da #507 perdeu 1 envio).
  ok(fila.slice(1).map((l) => l.id).join(',') === 'a,b,c,d', 'fallback na ordem da busca (updated_at), sem reordenar por avaliações');
}

console.log('Watchdog: bloco semanal com a taxa de e-mail confirmado por nicho');
{
  const janelaEm = (iso) => { const real = Date.now; const D = Date; globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new D(iso).getTime(); } };
    try { return rodar('w_janela.js')[0].json; } finally { globalThis.Date = D; Date.now = real; } };
  ok(janelaEm('2026-10-19T13:15:00Z').semanal === true, 'segunda 19/10 10:15 BRT → semanal');
  ok(janelaEm('2026-10-20T13:15:00Z').semanal === false, 'terça → sem bloco semanal');
  const cen = (semanal, nicho) => rodar('w_resumo.js', { nodes: { 'Janela de hoje': [{ json: { dia: '2026-10-19', inicio: '2026-10-19T03:00:00.000Z', diaUtil: true, semanal } }],
    'W: status envio': [{ json: { primeiro_envio: '2026-09-29T12:31:52.982Z' } }], 'W: envios hoje': [{ json: {} }], 'W: verificados hoje': [{ json: { id: 1 } }],
    'W: contatos hoje': [{ json: {} }], 'W: uso API hoje': [{ json: {} }], 'W: respostas hoje': [{ json: {} }], 'W: fila sem verificação': [{ json: {} }],
    'W: contatos pendentes': [{ json: {} }], 'W: confirmação por nicho': nicho.map((json) => ({ json })) } })[0].json;
  const linhas = [{ nicho: 'oficina_mecanica', captados: 120, verificados: 15, com_safe: 3, pct_safe_captados: '2.5', pct_safe_verificados: '20.0', captados_7d: 120, com_safe_7d: 3 },
                  { nicho: 'advocacia', captados: 87, verificados: 30, com_safe: 7, pct_safe_captados: '8.0', pct_safe_verificados: '23.3', captados_7d: 0, com_safe_7d: 2 }];
  const seg = cen(true, linhas);
  ok(seg.texto.includes('oficina_mecanica: 120 → 15 → 3 (safe/captados 2,5% · safe/verificados 20,0%)') && seg.porNicho.length === 2,
     'segunda: captados → verificados → safe, com safe/captados (principal) antes de safe/verificados');
  ok(!cen(false, linhas).texto.includes('por nicho'), 'outros dias: sem bloco semanal');
  ok(cen(true, [{ error: { message: 'relation does not exist' } }]).texto.includes('indisponível'), 'view ausente (falha suave) → aviso, resumo diário sai igual');
}

console.log('Estrutura do workflow');
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n) => (w.connections[n]?.main || []).map((br) => (br || []).map((c) => c.node));
  ok(saidas('Pedido IA - e-mail')[0]?.[0] === 'Teto do fallback?', 'Pedido IA → Teto do fallback?');
  ok(saidas('Teto do fallback?')[0]?.[0] === 'Parar: teto do fallback' && saidas('Teto do fallback?')[1]?.[0] === 'Reservar cota IA (e-mail)',
     'teto: sim → Parar; não → Reservar cota IA');
  ok(/order=updated_at\.asc,id\.asc&/.test(no('Buscar fila fallback').parameters.url) && !/total_avaliacoes/.test(no('Buscar fila fallback').parameters.url),
     'busca do fallback na ordem antiga (updated_at), sem prioridade por avaliações');
  ok(no('Buscar fila fallback').executeOnce === true && no('Buscar fila com e-mail').executeOnce === true,
     'buscas da fila rodam 1 vez (antes: 1 por lead com e-mail, 120 itens em 07/10)');
  ok(no('Validar resposta IA - e-mail').parameters.jsCode.includes('sem_candidato'), 'validador do dist com o atalho sem candidato');
  const wd = JSON.parse(readFileSync(`${R}/dist/novax-robson-watchdog.json`, 'utf8'));
  const n6 = wd.nodes.find((x) => x.name === 'W: confirmação por nicho');
  ok(n6 && n6.onError === 'continueRegularOutput' && n6.executeOnce === true && /prospeccao_confirmacao_nicho/.test(n6.parameters.url),
     'watchdog consulta a view 006 uma vez, com falha suave');
  ok(wd.connections['W: contatos pendentes'].main[0][0].node === 'W: confirmação por nicho'
     && wd.connections['W: confirmação por nicho'].main[0][0].node === 'Montar resumo', 'consulta semanal entre "contatos pendentes" e "Montar resumo"');
  const sql = readFileSync(`${R}/../supabase/006_confirmacao_nicho.sql`, 'utf8');
  ok(/create or replace view/i.test(sql) && !/\b(drop|alter|delete|update|insert)\b/i.test(sql) && /revoke all .* from anon, authenticated/i.test(sql),
     'migration 006 é só uma view (aditiva), sem acesso para anon/authenticated');
}

console.log('BUILD_ID independente do fim de linha (07/10: core.autocrlf mudava o ID do mesmo commit)');
{
  const id = (flip) => {
    const d = mkdtempSync(join(tmpdir(), 'prsp-eol-'));
    cpSync(R, d, { recursive: true, filter: (s) => !s.includes('dist') });
    for (const f of flip) {
      const t = readFileSync(join(d, f), 'utf8');
      writeFileSync(join(d, f), t.includes('\r\n') ? t.replace(/\r\n/g, '\n') : t.replace(/\n/g, '\r\n'));
    }
    const out = execFileSync(process.execPath, [join(d, 'build.mjs')], { stdio: 'pipe' }).toString();
    rmSync(d, { recursive: true, force: true });
    return out.match(/build ([0-9a-f]{12})/)[1];
  };
  const base = id([]);
  ok(id(['config.json', 'code/w_janela.js', 'code/_lib.js', 'build.mjs']) === base, `trocar LF↔CRLF em 4 arquivos mantém o ID (${base})`);
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
