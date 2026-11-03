// Fase 2 — follow-up (prspFollowUp001). Dados fictícios. Uso: node workflow/tests/followup.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const libCom = (cfg) => new Function('CONFIG', LIB + `; return { diaBRT, ehDiaUtil, diasUteisEntre, elegiveisFollowup, tetoFollowupDia,
  checarCorpoFollowup, emailRaw, assuntoResposta };`)(cfg);
const lib = libCom(CONFIG);
const RealDate = Date;
const comData = (iso, fn) => {
  const fixo = new RealDate(iso).getTime();
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixo])); } static now() { return fixo; } };
  try { return fn(); } finally { globalThis.Date = RealDate; }
};
const rodar = (file, { input = [], nodes = {}, staticData = {}, cfg = CONFIG } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: 'E1' }, cfg);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

console.log('Dias úteis (feriados nacionais não contam)');
ok(lib.diasUteisEntre('2026-11-09', '2026-11-12') === 3, 'seg 09/11 → qui 12/11 = 3 (D+3)');
ok(lib.diasUteisEntre('2026-10-30', '2026-11-04') === 2, 'sex 30/10 → qua 04/11 = 2 (02/11, Finados, não conta)');
ok(lib.diasUteisEntre('2026-11-19', '2026-11-23') === 1, 'qui 19/11 → seg 23/11 = 1 (20/11, Consciência Negra, não conta)');
ok(!lib.ehDiaUtil('2026-11-20') && !lib.ehDiaUtil('2026-11-07') && lib.ehDiaUtil('2026-11-05'), '20/11 e sábado não são dias úteis; 05/11 é');
ok(CONFIG.feriados.includes('2026-11-20') && CONFIG.feriados.includes('2026-11-02'), 'config.feriados com 02/11 e 20/11');

// Envios fictícios: dia BRT 12:30 (09:30 local).
const lead = (id, o = {}) => ({ id, nome: 'Oficina Aurora Fictícia', cidade: 'Vila Exemplo', estado: 'GO', nicho: 'oficina_mecanica',
  status: 'email_enviado', rating: 4.6, total_avaliacoes: 38, tipo_google: 'Oficina mecânica', retomar_em: null, ...o });
const contato = (o = {}) => ({ id: 'c', email: 'oficinaauroraficticia@gmail.com', bloqueado: false, bloqueado_motivo: null, ...o });
const envio = (leadId, dia, o = {}) => ({ id: `e-${leadId}-${dia}-${o.tipo || 'p'}`, lead_id: leadId, contato_id: 'c', tipo: 'prospeccao', teste: false,
  status: 'enviado', enviado_em: `${dia}T12:30:00Z`, message_id: `<${leadId}-${dia}@gmail.com>`, assunto: 'Uma ideia para Oficina Aurora',
  corpo: 'Olá! Sou o João, da Novax. Pesquisei oficinas em Vila Exemplo no Google e o perfil apareceu sem site.', resposta_recebida_em: null,
  lead: lead(leadId), contato: contato(), ...o });
const eleg = (envios, hoje, resp = []) => lib.elegiveisFollowup(envios, new Set(resp), hoje);
const so = (r, id) => r.escolhidos.find((e) => e.lead.id === id);

console.log('Elegibilidade (cada condição isolada)');
{
  const hoje = '2026-11-12';
  ok(so(eleg([envio('A', '2026-11-09')], hoje), 'A')?.toque === 2, 'toque 1 há 3 dias úteis → toque 2');
  ok(!so(eleg([envio('A', '2026-11-10')], hoje), 'A'), 'toque 1 há 2 dias úteis → ainda não');
  const ini15 = '2026-10-21'; // 21/10 → 12/11 = 15 dias úteis (02/11 fora)
  ok(lib.diasUteisEntre(ini15, hoje) === 15 && so(eleg([envio('A', ini15)], hoje), 'A')?.toque === 2, 'toque 1 há exatamente 15 dias úteis → ainda entra');
  const r16 = eleg([envio('A', '2026-10-20')], hoje);
  ok(!so(r16, 'A') && r16.fora['toque 1 há mais de 15 dias úteis'] === 1, 'toque 1 há 16 dias úteis → fica sem follow-up');
  ok(!so(eleg([envio('A', '2026-11-09')], hoje, ['A']), 'A'), 'lead com linha em prospeccao_respostas → fora');
  ok(!so(eleg([envio('A', '2026-11-09', { resposta_recebida_em: '2026-11-10T13:00:00Z' })], hoje), 'A'), 'envio com resposta_recebida_em → fora');
  ok(!so(eleg([envio('A', '2026-11-09', { lead: lead('A', { status: 'respondeu' }) })], hoje), 'A'), 'lead fora de email_enviado → fora');
  ok(!so(eleg([envio('A', '2026-11-09', { contato: contato({ bloqueado: true }) })], hoje), 'A'), 'contato bloqueado → fora');
  ok(!so(eleg([envio('A', '2026-11-09', { contato: contato({ bloqueado_motivo: 'descadastro' }) })], hoje), 'A'), 'contato com bloqueado_motivo → fora');
  ok(!so(eleg([envio('A', '2026-11-09', { message_id: null })], hoje), 'A'), 'sem message_id (não dá para manter a conversa) → fora');
  ok(!so(eleg([envio('A', '2026-11-09', { lead: lead('A', { retomar_em: '2026-12-01T12:00:00Z' }) })], hoje), 'A'), 'retomar_em no futuro → fora');
  ok(!!so(eleg([envio('A', '2026-11-09', { lead: lead('A', { retomar_em: '2026-11-01T12:00:00Z' }) })], hoje), 'A'), 'retomar_em no passado → entra');
  ok(!so(eleg([envio('A', '2026-11-09', { teste: true })], hoje), 'A'), 'envio inicial de teste não gera follow-up');
  ok(!so(eleg([envio('A', '2026-11-09', { status: 'erro' })], hoje), 'A'), 'envio inicial com erro não gera follow-up');
}
console.log('Toque 3 e fim da cadência');
{
  const t2 = (dia, o = {}) => envio('B', dia, { tipo: 'followup', id: `t2-${dia}`, message_id: `<t2-${dia}@gmail.com>`, corpo: 'Retomando a mensagem sobre o Google.', ...o });
  const base = [envio('B', '2026-11-02'), t2('2026-11-05')]; // toque 1 em 02/11 (feriado, conta a partir de 03/11)
  const r = eleg(base, '2026-11-11');
  const b = so(r, 'B');
  ok(b?.toque === 3 && b.pai.id === 't2-2026-11-05', 'toque 1 há ≥7 dias úteis e toque 2 há 4 → toque 3, respondendo ao toque 2');
  ok(JSON.stringify(b.references) === JSON.stringify(['<B-2026-11-02@gmail.com>', '<t2-2026-11-05@gmail.com>']), 'References = toque 1 + toque 2');
  ok(!so(eleg(base, '2026-11-10'), 'B'), 'toque 2 há só 3 dias úteis → toque 3 espera (mínimo 4)');
  ok(!so(eleg([envio('B', '2026-11-04'), t2('2026-11-05')], '2026-11-11'), 'B'), 'toque 1 há menos de 7 dias úteis → toque 3 espera');
  ok(!so(eleg([...base, t2('2026-11-11', { id: 't3' })], '2026-11-20'), 'B'), '3 toques feitos → nunca mais');
  ok(so(eleg([envio('B', '2026-11-04'), t2('2026-11-09', { teste: true })], '2026-11-12'), 'B')?.toque === 2, 'toque de teste não avança a cadência real');
}
console.log('Ordem e teto do dia');
{
  const r = eleg([envio('A', '2026-11-09'), envio('C', '2026-10-27'),
    envio('B', '2026-10-27'), { ...envio('B', '2026-11-05'), tipo: 'followup', id: 'tB', message_id: '<tB@gmail.com>' }], '2026-11-12');
  ok(r.escolhidos.map((e) => `${e.lead.id}${e.toque}`).join(',') === 'C2,A2,B3', 'toques 2 primeiro (mais perto de sair da janela), depois toques 3');
  const F = (o) => libCom({ ...CONFIG, followup: { ...CONFIG.followup, ...o } });
  ok(lib.tetoFollowupDia('sombra', 20, 0, '2026-11-05') === CONFIG.followup.sombraMaxTextos, `sombra: até ${CONFIG.followup.sombraMaxTextos} textos`);
  ok(lib.tetoFollowupDia('teste', 20, 0, '2026-11-10') === 3, 'teste: 3/dia');
  ok(F({ ligadoDesde: '2026-11-12' }).tetoFollowupDia('ligado', 20, 0, '2026-11-18') === 3, '1ª semana ligado (até 18/11): 3/dia');
  ok(F({ ligadoDesde: '2026-11-12' }).tetoFollowupDia('ligado', 20, 0, '2026-11-19') === 10, 'depois de 5 dias úteis (20/11 fora): 50% do limite (10 de 20)');
  ok(F({ ligadoDesde: '2026-11-12' }).tetoFollowupDia('ligado', 20, 18, '2026-11-25') === 2, 'nunca passa do espaço que sobra no limite do dia');
  ok(F({ ligadoDesde: null }).tetoFollowupDia('ligado', 20, 0, '2026-11-25') === 3, 'ligado sem data de início → fica no teto da 1ª semana (seguro)');
}

console.log('Validador do texto');
{
  const L = lead('A');
  const ant = ['Olá! Sou o João, da Novax. Pesquisei oficinas mecânicas em Vila Exemplo no Google e o perfil apareceu sem site.'];
  const bom2 = 'Volto ao assunto porque o perfil da Oficina Aurora no Google continua sem site, e quem procura o endereço ou quer ver os serviços não tem para onde ir. Você quer que eu mande um exemplo de como ficaria?';
  ok(lib.checarCorpoFollowup(bom2, L, 2, ant).length === 0, 'toque 2 correto passa');
  const bom3 = 'Esta é a minha última mensagem sobre o site da Oficina Aurora. Se não fizer sentido agora, sem problema, e fico à disposição se mudar de ideia.';
  ok(lib.checarCorpoFollowup(bom3, L, 3, ant).length === 0, 'toque 3 correto passa');
  const err = (t, toque = 2) => lib.checarCorpoFollowup(t, L, toque, ant).join(' | ');
  ok(/repete o e-mail anterior/.test(err('Pesquisei oficinas mecânicas em Vila Exemplo no Google e o perfil apareceu sem site. Posso te mandar um exemplo?')), 'repetir 6 palavras seguidas do toque anterior → reprovado');
  ok(/urgência falsa/.test(err('Última chance: o perfil da Oficina Aurora no Google segue sem site e temos vagas limitadas este mês. Quer conversar?')), 'urgência falsa → reprovado');
  ok(/sem o fato verificável/.test(err('Volto ao assunto do site da Oficina Aurora, que ainda não existe para quem procura vocês na cidade. Você quer ver um exemplo?')), 'toque 2 sem o fato do Google → reprovado');
  ok(/pergunta direta/.test(err('O perfil da Oficina Aurora no Google segue sem site, então quem procura o endereço não acha os serviços. Fico no aguardo.')), 'toque 2 sem pergunta no fim → reprovado');
  ok(/encerramento educado/.test(err('Escrevo de novo sobre o site da Oficina Aurora no Google, que ainda não tem endereço nem serviços. Posso mandar um exemplo?', 3)), 'toque 3 sem encerramento educado → reprovado');
  ok(/se apresenta de novo/.test(err('Olá! Sou o João, da Novax, e volto ao perfil da Oficina Aurora no Google, ainda sem site e sem serviços. Quer ver um exemplo?')), 'apresentar-se de novo → reprovado');
  ok(/nota "4,9" não bate/.test(err('O perfil da Oficina Aurora no Google (nota 4,9) segue sem site, e quem procura o endereço não acha os serviços. Quer ver um exemplo?')), 'nota errada → reprovado (mesmo checarFatos do envio frio)');
  ok(/vocês/.test(err('O perfil da Oficina Aurora no Google segue sem site, e quem procura vocês não acha os serviços nem o endereço. Querem ver um exemplo?')), '"vocês" para nome no singular → reprovado');
  ok(/com link/.test(err('O perfil da Oficina Aurora no Google segue sem site; veja um exemplo em www.exemplo.com.br com serviços e endereço. Faz sentido para você?')), 'link → reprovado');
}

console.log('E-mail RFC 2822 para a Gmail API');
{
  const raw = lib.emailRaw({ de: 'Novax <novax.ia.br@gmail.com>', para: 'oficinaauroraficticia@gmail.com', assunto: 'Re: Uma ideia para Oficina Aurora — ação',
    inReplyTo: '<A-1@gmail.com>', references: ['<A-1@gmail.com>', '<A-2@gmail.com>'], messageId: '<novo@gmail.com>', texto: 'Olá, você', html: '<div>Olá, você</div>' });
  ok(/^[A-Za-z0-9_-]+$/.test(raw), 'base64url sem "+", "/" nem "="');
  const msg = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  ok(/^In-Reply-To: <A-1@gmail\.com>$/m.test(msg) && /^References: <A-1@gmail\.com> <A-2@gmail\.com>$/m.test(msg), 'In-Reply-To e References da conversa');
  ok(/^Message-ID: <novo@gmail\.com>$/m.test(msg) && /^From: Novax <novax\.ia\.br@gmail\.com>$/m.test(msg), 'Message-ID e From');
  const subj = msg.match(/^Subject: =\?UTF-8\?B\?([^?]+)\?=$/m);
  ok(subj && Buffer.from(subj[1], 'base64').toString('utf8') === 'Re: Uma ideia para Oficina Aurora — ação', 'assunto com acento codificado em UTF-8 (RFC 2047)');
  const partes = [...msg.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map((m) => Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString('utf8'));
  ok(partes.length === 2 && partes[0] === 'Olá, você' && partes[1] === '<div>Olá, você</div>', 'partes text/plain e text/html em UTF-8');
}

console.log('Nós do módulo');
{
  const it = { lead: lead('A'), contato: contato(), toque: 2, du1: 3, inicial: envio('A', '2026-11-09'), pai: envio('A', '2026-11-09'),
    references: ['<A-2026-11-09@gmail.com>'], anteriores: ['Olá! Sou o João, da Novax.'], hoje: '2026-11-12', gerarTexto: true };
  const v = { corpo: 'Volto ao assunto do perfil no Google sem site. Quer ver um exemplo?', modelo: 'm' };
  const montar = (estagio) => rodar('f_montar.js', { nodes: { 'FU: loop': [{ json: { ...it, estagio } }], 'FU: validar texto': [{ json: v }] } })[0].json;
  const t = montar('teste'), l = montar('ligado'), s = montar('sombra');
  ok(t.destino === CONFIG.followup.redirecionarPara && t.assunto === CONFIG.followup.prefixoTeste + 'Re: Uma ideia para Oficina Aurora', 'teste: vai para o João, com o prefixo [TESTE 2.0 → followup]');
  ok(l.destino === 'oficinaauroraficticia@gmail.com' && l.assunto === 'Re: Uma ideia para Oficina Aurora', 'ligado: vai para o lead, "Re: <assunto original>"');
  ok(s.sombra === true && /^<[0-9a-f-]{36}@gmail\.com>$/.test(l.messageId), 'sombra marcada; Message-ID no formato dos envios (<uuid@gmail.com>)');
  ok(l.texto.includes('responda com a palavra SAIR'), 'mesmo rodapé LGPD (SAIR)');
  const reg = (j, o = {}) => rodar('f_registro.js', { input: [{ json: j }], nodes: { 'FU: loop': [{ json: { ...it, estagio: 'ligado', ...o } }] } })[0].json;
  ok(reg({ sombra: true, corpoIA: 'x' }, { estagio: 'sombra' }).registro.corpo === 'x', 'sombra: registro guarda o texto (sem rodapé)');
  ok(reg({}, { gerarTexto: false }).registro.erro === 'sem texto (teto da sombra)', 'além do teto da sombra: registro sem texto, sem IA');
  const f = reg({ ok: false, erro: 'texto inválido: x', raw: 'y' });
  ok(f.registro.erro === 'texto inválido: x' && f.trello && /FOLLOW-UP/.test(f.trello.nome), 'texto reprovado fora da sombra: registro + card de revisão no Trello');
  ok(reg({ ok: false, erro: 'x' }, { estagio: 'sombra' }).trello === null, 'na sombra, falha não abre card');
  ok(reg({ bloqueado: true }).trello === null && reg({ bloqueado: true }).registro.erro === 'contato bloqueado na hora do envio', 'bloqueio na hora: registra, sem card');
  const res = rodar('f_resultado.js', { input: [{ json: { statusCode: 200, body: { id: 'gm1', threadId: 'th' } } }],
    nodes: { 'FU: loop': [{ json: { ...it, estagio: 'teste' } }], 'FU: pode enviar?': [{ json: { assunto: 'Re: x', texto: 'y', messageId: '<m@gmail.com>' } }] } })[0].json;
  ok(res.ok && res.envio.tipo === 'followup' && res.envio.toque === 2 && res.envio.envio_pai_id === it.pai.id && res.envio.origem_modulo === 'followup'
     && res.envio.teste === true && res.envio.message_id === '<m@gmail.com>', 'envio gravado: tipo followup, toque, envio_pai_id, origem_modulo, teste');
  const erro = rodar('f_resultado.js', { input: [{ json: { statusCode: 403, body: { error: { message: 'insufficient' } } } }],
    nodes: { 'FU: loop': [{ json: { ...it, estagio: 'ligado' } }], 'FU: pode enviar?': [{ json: {} }] } })[0].json;
  ok(!erro.ok && erro.envio.status === 'erro' && /gmail 403/.test(erro.envio.erro), 'falha da Gmail API → envio com status erro');
  ok(comData('2026-11-12T12:24:00Z', () => rodar('f_hora.js', { input: [{ json: {} }] })[0].json.aTempo) === true
     && comData('2026-11-12T12:25:00Z', () => rodar('f_hora.js', { input: [{ json: {} }] })[0].json.aTempo) === false, 'para às 09:25 BRT');
  const cfgDesl = { ...CONFIG, modulos: { ...CONFIG.modulos, followup: { estagio: 'desligado' } } };
  ok(rodar('f_inicio.js', { cfg: cfgDesl }).length === 0, 'desligado → sai no primeiro nó');
  ok(comData('2026-11-20T12:00:00Z', () => rodar('f_inicio.js')).length === 0, 'feriado (20/11) → não roda');
  ok(comData('2026-11-05T12:00:00Z', () => rodar('f_inicio.js'))[0].json.hoje === '2026-11-05', 'dia útil → roda');
  const el = (estagio) => rodar('f_elegiveis.js', { nodes: {
    'FU: início': [{ json: { estagio, hoje: '2026-11-12' } }], 'FU: status envio': [{ json: { primeiro_envio: '2026-09-29T12:31:52Z', total_todos_hoje: 0 } }],
    'FU: envios': Array.from({ length: 12 }, (_, i) => ({ json: envio('L' + i, '2026-11-09') })), 'FU: respostas': [] } }).map((i) => i.json);
  const sb = el('sombra'), ts = el('teste');
  ok(sb.length === 12 && sb.filter((x) => x.gerarTexto).length === CONFIG.followup.sombraMaxTextos, `sombra: registra os 12, texto para ${CONFIG.followup.sombraMaxTextos}`);
  ok(ts.length === 3 && ts.every((x) => x.gerarTexto), 'teste: só 3 seguem');
}

console.log('Estrutura do workflow');
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-robson-followup.json`, 'utf8'));
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((x) => x.node);
  ok(w.id === 'prspFollowUp001' && w.active === true, 'id prspFollowUp001');
  ok(no('Diário - Follow-up').parameters.rule.interval[0].expression === '0 9 * * 1-5', 'cron 09:00 em dias úteis');
  const g = no('FU: Gmail enviar');
  ok(g.credentials.googleOAuth2Api.id === 'FkmazYel2pQxKksn' && /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send$/.test(g.parameters.url)
     && g.parameters.jsonBody === '={{ JSON.stringify({ raw: $json.raw }) }}', 'envio pela Gmail API (raw) com a credencial Gmail API - Prospeccao');
  // Caminhos até o Gmail: só por "FU: liberado?" (verdadeiro), que só vem de "FU: sombra?" falso.
  const pais = (n) => Object.entries(w.connections).flatMap(([de, c]) => c.main.flatMap((s, i) => s.filter((x) => x.node === n).map(() => ({ de, i }))));
  ok(JSON.stringify(pais('FU: Gmail enviar')) === JSON.stringify([{ de: 'FU: liberado?', i: 0 }]) && saidas('FU: sombra?', 0)[0] === 'FU: registro'
     && saidas('FU: sombra?', 1)[0] === 'FU: checar bloqueio', 'sombra nunca chega ao envio; envio só depois da checagem de bloqueio');
  ok(!w.nodes.some((n) => n.type === 'n8n-nodes-base.emailSend' && n.name !== 'FU: e-mail ao João')
     && /FU: resumo/.test(no('FU: e-mail ao João').parameters.toEmail), 'o único SMTP é o resumo para o João');
  ok(saidas('FU: ainda dá tempo?', 1)[0] === 'FU: resumo' && saidas('FU: cota IA ok?', 1)[0] === 'FU: resumo', '09:25 ou sem cota de IA → para e manda o resumo');
  ok(['FU: status envio', 'FU: envios', 'FU: respostas'].every((n) => no(n).executeOnce), 'consultas iniciais rodam uma vez');
  ok(no('FU: reservar cota IA').onError === 'continueRegularOutput' && no('FU: envios').retryOnFail, 'retry do Supabase e reserva segura (hotfix de 03/11)');
  const est = CONFIG.modulos.followup.estagio;
  ok(['desligado', 'sombra', 'teste', 'ligado'].includes(est), `estágio válido (${est})`);
  ok(est !== 'ligado' || /^\d{4}-\d{2}-\d{2}$/.test(CONFIG.followup.ligadoDesde || ''), 'ligado sempre com followup.ligadoDesde (início da 1ª semana, teto 3/dia)');
}

console.log('Migration 009');
{
  // "on delete cascade/set null" das chaves estrangeiras não é DELETE.
  const sql = readFileSync(`${R}/../supabase/009_followup.sql`, 'utf8').replace(/--.*$/gm, '').replace(/on delete (cascade|set null)/gi, '');
  ok(!/\b(drop|alter\s+table\s+public\.prospeccao_(leads|envios|contatos)|delete|update|truncate)\b/i.test(sql), 'aditiva: só cria a tabela nova');
  ok(/enable row level security/.test(sql) && /revoke all on public\.prospeccao_followup_sombra from anon, authenticated/.test(sql), 'RLS e sem acesso de anon/authenticated');
  ok(/unique \(dia, lead_id, toque\)/.test(sql), 'um registro por lead, toque e dia (rodar de novo não duplica)');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
