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
// Nichos já buscados (sem paginação, repetir só traria duplicados) ficam no fim do ciclo; os novos de maior volume vêm primeiro.
const ANTIGOS = ['odontologia_estetica', 'advocacia', 'estetica_harmonizacao', 'varejo_local'];
const s0 = [...new Set(semanas[0].map((x) => x.nicho))];
ok(JSON.stringify(s0) === JSON.stringify(['oficina_mecanica', 'salao_barbearia', 'pet_veterinaria', 'material_construcao']), '12/10 (semana 0): oficinas, salões/barbearias, pet shops/veterinárias, material de construção');
ok(JSON.stringify(CONFIG.catalogoNichos.slice(-4).map((n) => n.nicho)) === JSON.stringify(ANTIGOS), 'os 4 nichos antigos são os últimos do catálogo');
const primeiraAntiga = semanas.findIndex((b) => b.some((x) => ANTIGOS.includes(x.nicho)));
ok(primeiraAntiga === Math.floor((CONFIG.catalogoNichos.length - 4) / CONFIG.rotacao.nichosPorSemana), `nicho antigo só volta na semana ${primeiraAntiga} (depois de todos os novos)`);
ok(semanas.slice(0, primeiraAntiga).every((b) => b.every((x) => !ANTIGOS.includes(x.nicho))), 'nenhum nicho antigo antes disso');
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

console.log('Calendar sem autorização → revisão manual (achado de 07/10)');
const decidir = { q: { resposta_sugerida: 'Obrigado pelo retorno, podemos conversar.', resumo: 'quer reunião' } };
const semCal = rodar('c_horarios.js', [{ json: { error: { message: 'invalid_grant' } } }], { 'Contexto da resposta': ctx, 'Decidir próxima ação': decidir })[0].json;
ok(semCal.calendario_falhou === true && !semCal.texto && semCal.erro.includes('invalid_grant'), 'freeBusy com erro → não monta e-mail ao lead, marca calendario_falhou');
const rev = rodar('c_revisao.js', [{ json: semCal }], { 'Contexto da resposta': { ...ctx, resposta: { from: 'a@exemplo.com', texto: 'Quero marcar uma conversa' } } })[0].json;
ok(rev.lead_patch.status === 'revisao_manual' && rev.trello_lista === CONFIG.trello.revisaoManual && /Calendar indispon/.test(rev.lead_patch.motivo_revisao)
   && rev.trello_desc.includes('Quero marcar uma conversa'), 'revisão manual no Trello com a resposta completa do lead');
const comCal = rodar('c_horarios.js', [{ json: { calendars: { primary: { busy: [] } } } }], { 'Contexto da resposta': ctx, 'Decidir próxima ação': decidir })[0].json;
ok(!comCal.calendario_falhou && comCal.opcoes.length === CONFIG.agenda.opcoes, 'Calendar ok → proposta com horários reais como antes');

console.log('Aviso ao João quando resposta de lead cai em revisão manual');
const saidaRev = { acao_v1: 'revisao_manual', lead: { id: 'L', nome: 'Exemplo Ltda', cidade: 'Cidade X', estado: 'SC', trello_card_id: null },
  lead_patch: { status: 'revisao_manual', motivo_revisao: 'Google Calendar indisponível ao propor horários' } };
const av = rodar('c_aviso_revisao.js', [{ json: {} }], { 'Saída (C)': saidaRev, 'Salvar card no lead (C)': { trello_card_id: 'card123' },
  'Trello - criar card (C)': { id: 'card123', shortUrl: 'https://trello.com/c/abc' }, 'Trello - mover card (C)': { id: 'outro', shortUrl: 'https://trello.com/c/velho' } })[0].json;
ok(av.destino === CONFIG.alertaDestino && av.assunto === '[Robson] Lead respondeu — revisão manual', 'vai para o João (alertaDestino) com o assunto combinado');
ok(['Exemplo Ltda', 'Cidade X/SC', 'Google Calendar indisponível', 'https://trello.com/c/abc'].every((t) => av.texto.includes(t)), 'corpo com empresa, cidade, motivo e link do card');
ok(!av.texto.includes('velho'), 'ignora card de outra resposta do mesmo loop (id diferente do salvo)');
const av2 = rodar('c_aviso_revisao.js', [{ json: {} }], { 'Saída (C)': saidaRev, 'Salvar card no lead (C)': { trello_card_id: 'card999' } })[0].json;
ok(av2.link === 'https://trello.com/c/card999', 'sem resposta do Trello: link pelo id salvo no lead');

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
  ok(saidas('Montar proposta de horários')[0] === 'Calendar ok? (proposta)' && saidas('Calendar ok? (proposta)', 0)[0] === 'Enviar proposta (SMTP)'
     && saidas('Calendar ok? (proposta)', 1)[0] === 'Revisão manual (resposta)' && saidas('Livre?', 1)[0] === 'Calendar - freeBusy (proposta)',
     `[${motor}] falha do Calendar (proposta ou checagem do horário) cai em revisão manual`);
  ok(saidas('Salvar card no lead (C)')[0] === 'Avisar João? (C)' && saidas('Avisar João? (C)', 0)[0] === 'Montar aviso de revisão'
     && saidas('Montar aviso de revisão')[0] === 'Enviar aviso de revisão (SMTP)' && saidas('Enviar aviso de revisão (SMTP)')[0] === 'Loop respostas'
     && saidas('Avisar João? (C)', 1)[0] === 'Loop respostas', `[${motor}] resposta de lead: card → aviso ao João só em revisão manual`);
  ok(/acao_v1 === 'revisao_manual'/.test(no('Avisar João? (C)').parameters.conditions.conditions[0].leftValue), `[${motor}] aviso condicionado a acao_v1 = revisao_manual`);
  ok(no('Enviar aviso de revisão (SMTP)').onError === 'continueRegularOutput', `[${motor}] falha no aviso não trava o loop de respostas`);
  ok(saidas('Salvar card no lead (B)')[0] === 'Houve envio? (B)' && !w.nodes.some((n) => /aviso/i.test(n.name) && /\(B\)/.test(n.name))
     && !JSON.stringify(w.connections['Revisão manual (e-mail)']).includes('aviso'), `[${motor}] revisão do texto da IA no envio frio continua só no Trello`);
  ok(/primaryTypeDisplayName/.test(JSON.stringify(no('Places - Text Search').parameters)), `[${motor}] Places pede o tipo do estabelecimento`);
  ok(/p_limite: 300/.test(no('Reservar cota Places').parameters.jsonBody), `[${motor}] reserva de cota mensal com teto 300`);
}

console.log('Números por extenso no validador (07/10: "tem uma avaliação no Google" passou com 1 avaliação)');
{
  const L = (aval, rating = 5) => ({ nome: 'Advocacia Exemplar', cidade: 'Vila Fictícia', rating, total_avaliacoes: aval, segmento: 'advocacia', nicho: 'advocacia' });
  const tem = (txt, lead, re) => lib.checarFatos(txt, lead).some((e) => re.test(e));
  // Texto real enviado em 07/10, com nome e cidade trocados por fictícios.
  const real = 'Olá, vi que a Advocacia Exemplar, em Vila Fictícia/SC, tem uma avaliação no Google mas não possui site vinculado ao seu perfil.';
  ok(tem(real, L(1), /só 1 avaliações/), 'texto real de 07/10 (1 avaliação, por extenso) é reprovado');
  ok(tem('tem duas avaliações no Google', L(2), /só 2 avaliações/), '"duas avaliações" com poucas avaliações é reprovado');
  ok(tem('com três avaliações', L(3), /só 3 avaliações/), '"três" (com acento) é reconhecido');
  ok(tem('uma única avaliação no Google', L(1), /só 1 avaliações/), '"uma única avaliação" é reconhecido');
  ok(tem('nota cinco no Google', L(4), /só 4 avaliações/), '"nota cinco" com poucas avaliações é reprovado');
  ok(tem('cinco estrelas no Google', L(4), /só 4 avaliações/), '"cinco estrelas" com poucas avaliações é reprovado');
  ok(tem('tem dez avaliações', L(40), /"10 avaliações" não bate/), 'número por extenso errado não bate com o Google');
  ok(tem('nota quatro no Google', L(40, 4.8), /nota "4" não bate/), '"nota quatro" com nota 4,8 é reprovado');
  ok(!lib.checarFatos('Um site profissional resolveria uma lacuna; tem um perfil no Google com 40 avaliações e nota 4,8.', L(40, 4.8)).length,
     '"um site", "uma lacuna", "um perfil" não viram número; texto correto passa');
  // Estruturas de 2 envios reais corretos (30/09 e 07/10): "uma avaliação" = a nota, seguida do número decimal.
  ok(!lib.checarFatos('A Advocacia Exemplar, em Vila Fictícia, possui uma avaliação de 4,9 com 62 avaliações no Google.', L(62, 4.9)).length,
     '"possui uma avaliação de 4,9 com 62 avaliações" (artigo) continua passando');
  ok(!lib.checarFatos('Percebi que o escritório tem uma avaliação no Google de 5,0 com 232 avaliações.', L(232)).length,
     '"tem uma avaliação no Google de 5,0 com 232 avaliações" (artigo) continua passando');
  ok(!lib.checarFatos('Gostaria de marcar uma reunião de 30 minutos? Em uma conversa rápida mostro dois exemplos.', L(1)).length,
     'lead com poucas avaliações sem citar nota/avaliações passa');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
