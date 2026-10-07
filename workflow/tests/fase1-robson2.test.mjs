// Robson 2.0 — Fase 1 (dados fictícios: o repositório é público). Offline. Uso: node workflow/tests/fase1-robson2.test.mjs
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { classificarPerfil, checarFatos, emailIdentificaEmpresa, enviadosReaisHoje };')(CONFIG);
// Executa um Code node com $input e $('Nó') simulados.
const rodar = (f, input, nos = {}, cfg = CONFIG, pre = '') => new Function('$input', '$', 'CONFIG', LIB + '\n' + pre + '\n' + readFileSync(`${R}/code/${f}`, 'utf8'))(
  { first: () => input[0], all: () => input },
  (n) => ({ first: () => ({ json: nos[n] }), all: () => [{ json: nos[n] }] }), cfg);
const comData = (iso, fn) => { const real = Date.now; Date.now = () => new Date(iso).getTime(); try { return fn(); } finally { Date.now = real; } };
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Limite diário compartilhado');
ok(lib.enviadosReaisHoje({ total_hoje: 3, total_todos_hoje: 7 }) === 7, 'usa total_todos_hoje (frio + follow-up + respostas)');
ok(lib.enviadosReaisHoje({ total_hoje: 3 }) === 3, 'sem a migration 005: cai para total_hoje (conta antiga)');
ok(lib.enviadosReaisHoje(undefined) === 0, 'sem linha de status: 0');
const prim = '2026-09-29T12:31:52Z';
const lim = (s) => comData('2026-10-08T12:30:00Z', () => rodar('b_limite_dia.js', [{ json: { primeiro_envio: prim, ...s } }]));
ok(lim({ total_hoje: 0, respostas_hoje: 4, total_todos_hoje: 4 })[0].json.restante === 6, 'limite 10 com 4 respostas já enviadas → frio usa as 6 que sobram');
ok(lim({ total_hoje: 2, respostas_hoje: 8, total_todos_hoje: 10 }).length === 0, 'respostas lotaram o limite → nenhum envio frio');
const cabe = (s) => rodar('b_cabe_no_dia.js', [{ json: s }], { 'Calcular limite do dia': { limite: 10 }, 'Loop leads': { id: 'x' } })[0].json.cabe;
ok(cabe({ total_hoje: 5, total_todos_hoje: 9 }) === true && cabe({ total_hoje: 5, total_todos_hoje: 10 }) === false, 'checagem por lead também soma todos os tipos');

console.log('Rotação "todo segmento"');
const semanas = [];
for (let w = 0; w < 30; w++) {
  const iso = new Date(new Date('2026-10-12T10:00:00Z').getTime() + w * 7 * 864e5).toISOString();
  semanas.push(comData(iso, () => rodar('a_montar_buscas.js', [{ json: {} }]).map((i) => i.json)));
}
ok(semanas.every((b) => b.length <= CONFIG.limitePlacesPorExecucao && b.length <= 60), 'no máximo 60 buscas por semana (limitePlacesPorExecucao)');
ok(semanas.every((b) => new Set(b.map((x) => x.nicho)).size === CONFIG.rotacao.nichosPorSemana), '4 nichos diferentes por semana');
ok(CONFIG.limitePlacesPorExecucao * 5 <= CONFIG.tetoMensalPlaces && CONFIG.tetoMensalPlaces <= 300, 'mês com 5 segundas: ≤ 300 buscas (teto mensal 300 de 900)');
const vistos = new Map(); let repetiu = 0;
for (const b of semanas) for (const x of b) { const k = `${x.ciclo}|${x.nicho}|${x.cidade}|${x.estado}`; if (vistos.has(k)) repetiu++; vistos.set(k, 1); }
ok(repetiu === 0, 'nenhuma combinação nicho×cidade se repete dentro do ciclo (30 semanas)');
const cobertas = new Set(semanas.flat().filter((x) => x.nicho === CONFIG.catalogoNichos[0].nicho && x.ciclo === 0).map((x) => x.cidade + x.estado));
ok(cobertas.size === CONFIG.cidades.GO.length + CONFIG.cidades.SC.length, '1º nicho cobre as 56 cidades de GO+SC no ciclo 0');
ok(semanas[0].every((x) => /^.+ em .+ - (GO|SC)$/.test(x.textQuery)), 'busca no formato "<termo> em <cidade> - UF"');
ok(CONFIG.catalogoNichos.length >= 20 && CONFIG.catalogoNichos.every((n) => n.termos.length >= 1 && n.termos.length <= 2), 'catálogo com 20+ nichos e 1–2 termos cada');

console.log('Filtro de perfil (todo nicho)');
for (const [nome, tipos, nicho, esp] of [
  ['Igreja Batista Esperança', [], 'buffet_eventos', 'religiosa'], ['Espaço Aurora', ['place_of_worship'], 'buffet_eventos', 'religiosa'],
  ['Prefeitura Municipal de Exemplo', [], 'grafica', 'orgao_publico'], ['Detran Posto Centro', [], 'autoescola', 'orgao_publico'],
  ['Sindicato dos Contabilistas', [], 'contabilidade', 'entidade'], ['Carlos Pereira', [], 'serralheria', 'pessoa_fisica'],
  ['Prof Lívia Toledo', [], 'escola_idiomas', 'pessoa_fisica'], ['Dra Lívia Toledo', [], 'fisioterapia', 'ok'], ['Dra. Bruna Viana', [], 'odontologia_estetica', 'ok'], ['Rafa Personal Trainer', [], 'academia_pilates', 'pessoa_fisica'],
  ['Bella Moda', [], 'varejo_local', 'ok'], ['Serralheria Pereira', [], 'serralheria', 'ok'], ['Dra Lívia Toledo Fisioterapia', [], 'fisioterapia', 'ok'],
  ['Auto Center Zênite', ['car_repair'], 'oficina_mecanica', 'ok'],
  ['Caio Bremer', [], 'advocacia', 'pessoa_fisica'], ['Feltrin Advocacia', [], 'advocacia', 'ok'], ['Odila Ramos Prestes Vanin', [], 'advocacia', 'ok']]) {
  ok(lib.classificarPerfil(nome, tipos, nicho) === esp, `"${nome}" (${nicho}) → ${esp}`);
}

console.log('Ramo divergente e prompt sem rótulo de nicho');
const spa = { nome: 'Zéfira Bem-Estar', tipo_google: 'Spa', tipos_google: ['spa', 'beauty_salon'], nicho: 'odontologia_estetica', rating: 4.8, total_avaliacoes: 40 };
ok(lib.checarFatos('A Zéfira Bem-Estar é uma clínica odontológica em Exemplo.', spa).some((e) => e.includes('odontologia')), 'chama de odontológica um lead do tipo Spa → rejeitado');
ok(lib.checarFatos('A Zéfira Bem-Estar é um espaço de estética em Exemplo.', spa).length === 0, 'estética num lead do tipo Spa → aceito');
const dent = { nome: 'Sorriso Prime', tipo_google: 'Dentista', tipos_google: ['dentist'], nicho: 'odontologia_estetica', rating: 5, total_avaliacoes: 30 };
ok(lib.checarFatos('A Sorriso Prime é uma clínica odontológica.', dent).length === 0, 'odontológica num lead do tipo Dentista → aceito');
ok(lib.checarFatos('Escritório de contabilidade em Exemplo.', dent).some((e) => e.includes('contabilidade')), 'contabilidade num dentista → rejeitado');
const antigo = { nome: 'Sorriso Prime', nicho: 'odontologia_estetica', rating: 5, total_avaliacoes: 30 };
ok(lib.checarFatos('A Sorriso Prime é uma clínica odontológica.', antigo).length === 0, 'lead antigo sem tipo do Google: o nicho da busca vale como evidência');
const ped = rodar('b_pedido_ia.js', [{ json: { lead: { ...dent, cidade: 'Exemplo', estado: 'GO', fila: { modo: 'texto' } } } }])[0].json;
const prompt = ped.messages.map((m) => m.content).join('\n');
ok(prompt.includes('Tipo no Google Maps: Dentista'), 'prompt traz o tipo do Google Maps');
ok(!CONFIG.catalogoNichos.some((n) => prompt.includes(n.nicho)) && !/Segmento pesquisado/.test(prompt), 'prompt sem rótulo interno de nicho');

console.log('Guarda de e-mail com termos genéricos de ramo/razão social');
ok(!lib.emailIdentificaEmpresa('oficinamecanicacentro@gmail.com', 'Oficina Mecânica Centro'), 'só termos de ramo → recusado');
ok(lib.emailIdentificaEmpresa('zenitemotorsport@gmail.com', 'Zênite Motorsport Oficina'), '2 palavras distintivas → aceito');
ok(!lib.emailIdentificaEmpresa('comercioserviços@gmail.com', 'Comércio e Serviços Ltda'), 'razão social genérica → recusado');

console.log('Ramo IMAP: acao_v1 em toda saída');
const ctx = { lead: { id: 'L', nome: 'Exemplo', cidade: 'C', estado: 'GO' }, contato: { id: 'K', email: 'a@exemplo.com', origem: 'codigo_nome' },
  envio: { id: 'E', assunto: 'Assunto', teste: false }, resposta: { from: 'a@exemplo.com', texto: 'SAIR' } };
ok(rodar('c_bloqueio.js', [{ json: { acao: 'optout' } }], { 'Contexto da resposta': ctx })[0].json.acao_v1 === 'optout', 'descadastro → acao_v1 optout');
ok(rodar('c_bloqueio.js', [{ json: { acao: 'perdido' } }], { 'Contexto da resposta': ctx })[0].json.acao_v1 === 'sem_interesse', 'sem interesse → acao_v1 sem_interesse');
ok(rodar('c_revisao.js', [{ json: { ok: false, tentativa: 3, tipo_falha: 'formato', erro: 'x' } }], { 'Contexto da resposta': ctx })[0].json.acao_v1 === 'revisao_manual', 'revisão → acao_v1 revisao_manual');
const prop = rodar('c_resultado_resposta.js', [{ json: { messageId: '<m@x>' } }], { 'Contexto da resposta': ctx, 'Decidir próxima ação': { q: { resumo: 'r' } },
  'Montar proposta de horários': { assunto: 'Re: a', texto: 't', opcoes: [] } }, CONFIG, "const MODO = 'proposta';")[0].json;
ok(prop.acao_v1 === 'proposta_horarios' && prop.lead_patch.status === 'respondeu', 'proposta → acao_v1 proposta_horarios, ação v1 igual à de antes');
const ext = rodar('c_extrair_resposta.js', [{ json: { inReplyTo: '<a@x>', references: '<a@x> <b@x>', from: { value: [{ address: 'p@exemplo.com' }] }, text: 'oi', messageId: '<r@x>' } }])[0].json;
ok(ext.in_reply_to === '<a@x>' && ext.references_raw === '<a@x> <b@x>' && ext.ignorar === false, 'extração guarda In-Reply-To e References brutos');

console.log('Estrutura do workflow (motor v1 e v2)');
const construir = (motor) => {
  const d = mkdtempSync(join(tmpdir(), 'prsp-'));
  cpSync(R, d, { recursive: true, filter: (s) => !s.includes('dist') });
  const c = JSON.parse(readFileSync(join(d, 'config.json'), 'utf8')); c.respostas.motor = motor;
  writeFileSync(join(d, 'config.json'), JSON.stringify(c));
  execFileSync(process.execPath, [join(d, 'build.mjs')], { stdio: 'pipe' });
  const w = JSON.parse(readFileSync(join(d, 'dist', 'novax-agente-prospeccao.json'), 'utf8'));
  rmSync(d, { recursive: true, force: true });
  return w;
};
for (const motor of ['v1', 'v2']) {
  const w = construir(motor);
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((x) => x.node);
  const g = no('Gravar resposta bruta');
  ok(g && g.retryOnFail && g.maxTries === 3 && g.onError === 'continueRegularOutput', `[${motor}] gravação com 3 tentativas e sem bloquear o fluxo`);
  ok(saidas('Ignorar? (C)', 1)[0] === 'Gravar resposta bruta' && saidas('Gravar resposta bruta')[0] === 'Registrar resposta no envio'
     && saidas('Registrar resposta no envio')[0] === 'É descadastro?', `[${motor}] gravação logo após casar o e-mail, antes de qualquer ação`);
  ok(saidas('É descadastro?', 0)[0] === 'Dados bloqueio', `[${motor}] SAIR continua imediato no v1`);
  ok(saidas('Motor v1?', 0)[0] === 'Pedido IA - qualificação' && saidas('Motor v1?', 1)[0] === 'Motor v2: só registra', `[${motor}] desvio do motor`);
  ok(no('Motor v1?').parameters.conditions.conditions[0].leftValue === `={{ ${motor === 'v1'} === true }}`, `[${motor}] flag embutida no build`);
  ok(saidas('Saída (C)')[0] === 'Registrar ação v1' && saidas('Registrar ação v1')[0] === 'Registrar envio? (C)', `[${motor}] acao_v1 final gravada sem mudar a cauda`);
  ok(/primaryTypeDisplayName/.test(JSON.stringify(no('Places - Text Search').parameters)), `[${motor}] Places pede o tipo do estabelecimento`);
  ok(/p_limite: 300/.test(no('Reservar cota Places').parameters.jsonBody), `[${motor}] reserva de cota mensal com teto 300`);
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
