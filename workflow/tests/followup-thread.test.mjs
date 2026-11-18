// 18/11 — teste de 17–18/11: a Gmail API (users.messages.send) troca o Message-ID gerado pelo follow-up pelo dela
// (<CAO8_…@mail.gmail.com>) e, só com gmail.send, não há como ler o real. Correção:
// (1) todo toque cita só o 1º e-mail: In-Reply-To = References = message_id do 1º e-mail (o real, conferido em Enviados);
// (2) grava id e threadId da resposta do envio; o toque 3 vai no threadId do toque 2 (conversa da Novax);
// (3) a resposta do lead a um follow-up casa pelo message_id do 1º e-mail que vem no References.
// Nomes e e-mails fictícios. Uso: node workflow/tests/followup-thread.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { elegiveisFollowup };')(CONFIG);
const rodar = (file, { input = [], nodes = {} } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }), () => ({}), CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };
const cabecalhos = (raw) => {
  const txt = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return Object.fromEntries(txt.split('\r\n\r\n')[0].split('\r\n').map((l) => [l.split(':')[0].toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]));
};

const ID1 = '<d0000000-0000-4000-8000-000000000001@gmail.com>';   // 1º e-mail (SMTP; é o Message-ID real)
const FALSO = '<6fa00000-0000-4000-8000-000000000002@gmail.com>'; // o que o follow-up gravava antes de 18/11
const REAL2 = '<CAO8_ficticio_toque2@mail.gmail.com>';          // o que o Gmail realmente enviou no toque 2
const lead = { id: 'L1', nome: 'Oficina Aurora', cidade: 'Vila Exemplo', estado: 'GO', status: 'email_enviado' };
const contato = { id: 'C1', email: 'oficinaauroraficticia@gmail.com' };
const inicial = { id: 'e1', lead_id: 'L1', contato_id: 'C1', tipo: 'prospeccao', toque: 1, teste: false, status: 'enviado',
  enviado_em: '2026-11-03T12:30:00Z', message_id: ID1, assunto: 'Uma ideia para Oficina Aurora', corpo: 'Olá! Sou o João, da Novax.', lead, contato };
const toque2 = (o = {}) => ({ id: 'e2', lead_id: 'L1', contato_id: 'C1', tipo: 'followup', toque: 2, teste: false, status: 'enviado',
  enviado_em: '2026-11-19T12:00:00Z', message_id: null, gmail_id: 'gm2', gmail_thread_id: 'thNovax1', assunto: 'Re: Uma ideia para Oficina Aurora',
  corpo: 'Imagine um cliente com o carro parado à noite.', lead, contato, ...o });

console.log('1. Cabeçalhos: todo toque cita só o 1º e-mail');
{
  const t2 = lib.elegiveisFollowup([inicial], new Set(), '2026-11-19').escolhidos[0];
  ok(t2.toque === 2 && t2.inReplyTo === ID1 && JSON.stringify(t2.references) === JSON.stringify([ID1]) && t2.threadId === null, 'toque 2: In-Reply-To = References = 1º e-mail; sem threadId');
  const t3 = lib.elegiveisFollowup([inicial, toque2()], new Set(), '2026-11-26').escolhidos[0];
  ok(t3.toque === 3 && t3.pai.id === 'e2' && t3.inReplyTo === ID1 && JSON.stringify(t3.references) === JSON.stringify([ID1]), 'toque 3 (26/11): In-Reply-To = References = 1º e-mail; envio_pai continua o toque 2');
  ok(t3.threadId === 'thNovax1', 'toque 3: threadId do toque 2 (gmail_thread_id)');
  const leg = lib.elegiveisFollowup([inicial, toque2({ message_id: FALSO, gmail_id: null, gmail_thread_id: null })], new Set(), '2026-11-26').escolhidos[0];
  ok(leg.toque === 3 && leg.threadId === null && !JSON.stringify(leg.references).includes('6fa0') && leg.inReplyTo === ID1,
    'toque 2 antigo (Message-ID falso, sem threadId): o toque 3 nunca cita o ID falso');

  const v = { corpo: 'Esta é a minha última mensagem sobre o site da Oficina Aurora. Se não fizer sentido agora, sem problema.', modelo: 'm' };
  const montar = (it, estagio) => rodar('f_montar.js', { nodes: { 'FU: loop': [{ json: { ...it, estagio } }], 'FU: validar texto': [{ json: v }] } })[0].json;
  const l = montar(t3, 'ligado'), h = cabecalhos(l.raw);
  ok(h['in-reply-to'] === ID1 && h.references === ID1, 'raw do toque 3: In-Reply-To e References = 1º e-mail');
  ok(!('message-id' in h) && l.messageId === undefined, 'raw sem Message-ID próprio (o Gmail gera o dele)');
  ok(h.from === `${CONFIG.remetente.nome} <${CONFIG.remetente.email}>` && h.to === contato.email, 'From da Novax, To do lead');
  ok(l.threadId === 'thNovax1', 'ligado: o envio leva o threadId do toque 2');
  ok(montar(t3, 'teste').threadId === null, 'teste: sem threadId (o assunto tem prefixo; não entra na conversa do lead)');
  ok(montar(t2, 'ligado').threadId === null, 'toque 2: sem threadId (o 1º e-mail saiu pelo SMTP; não temos o threadId dele)');
}

console.log('2. Grava id e threadId da resposta do envio');
{
  const it = { ...lib.elegiveisFollowup([inicial], new Set(), '2026-11-19').escolhidos[0], estagio: 'ligado' };
  const r = rodar('f_resultado.js', { input: [{ json: { statusCode: 200, body: JSON.stringify({ id: '19a0ficticio', threadId: '19a0thread', labelIds: ['SENT'] }) } }],
    nodes: { 'FU: loop': [{ json: it }], 'FU: pode enviar?': [{ json: { assunto: 'Re: Uma ideia para Oficina Aurora', texto: 'x' } }] } })[0].json;
  ok(r.ok && r.envio.gmail_id === '19a0ficticio' && r.envio.gmail_thread_id === '19a0thread' && r.envio.message_id === null && r.envio.status === 'enviado',
    'gmail_id e gmail_thread_id gravados; message_id nulo (o real não volta no envio)');
  const w = JSON.parse(readFileSync(`${R}/dist/novax-robson-followup.json`, 'utf8'));
  const envios = w.nodes.find((n) => n.name === 'FU: envios');
  ok(/gmail_thread_id/.test(JSON.stringify(envios.parameters)), '"FU: envios" lê gmail_thread_id (para o toque 3)');
  const g = w.nodes.find((n) => n.name === 'FU: Gmail enviar');
  const corpo = (j) => new Function('$json', 'return ' + g.parameters.jsonBody.replace(/^=\{\{|\}\}$/g, ''))(j);
  ok(JSON.parse(corpo({ raw: 'R', threadId: 'T' })).threadId === 'T' && !('threadId' in JSON.parse(corpo({ raw: 'R', threadId: null }))),
    'corpo da Gmail API: {raw, threadId} no toque 3; só {raw} sem threadId');
}

console.log('3. Resposta do lead a um follow-up (IMAP do Robson)');
{
  // O nó "Buscar envio original" procura prospeccao_envios.message_id IN (In-Reply-To + References), o mais recente.
  const banco = [{ id: 'e1', tipo: 'prospeccao', message_id: ID1, enviado_em: inicial.enviado_em }, { id: 'e2', tipo: 'followup', message_id: null, enviado_em: '2026-11-19T12:00:00Z' }];
  const buscar = (ids) => banco.filter((e) => e.message_id && ids.includes(e.message_id)).sort((a, b) => Date.parse(b.enviado_em) - Date.parse(a.enviado_em))[0] || null;
  const extrair = (m) => rodar('c_extrair_resposta.js', { input: [{ json: { from: { value: [{ address: contato.email }] }, text: 'Tenho interesse.',
    messageId: '<resposta@mail.gmail.com>', subject: 'Re: Uma ideia para Oficina Aurora', date: '2026-11-19T15:00:00Z', ...m } }] })[0].json;
  // Gmail/Outlook/Apple Mail: References = References do toque 2 (1º e-mail) + Message-ID real do toque 2.
  const a = extrair({ inReplyTo: REAL2, references: `${ID1} ${REAL2}` });
  ok(!a.ignorar && a.ids.includes(ID1) && buscar(a.ids)?.id === 'e1', 'resposta ao toque 2 casa com o 1º e-mail pelo References (não pelo ID do toque 2)');
  const b = extrair({ inReplyTo: REAL2, references: [ID1, REAL2] });
  ok(buscar(b.ids)?.id === 'e1', 'References em lista (formato do nó IMAP) também casa');
  // Resposta a um toque 2 ANTIGO (gravado com o ID falso): o ID falso nunca aparece; casa igual pelo 1º e-mail.
  ok(!extrair({ inReplyTo: REAL2, references: `${ID1} ${REAL2}` }).ids.includes(FALSO), 'o ID falso gravado antes de 18/11 nunca é usado para casar');
  // Limite conhecido: cliente que manda só In-Reply-To (sem References) não casa — já era assim antes do follow-up.
  const c = extrair({ inReplyTo: REAL2, references: '' });
  ok(buscar(c.ids) === null, 'limite: só In-Reply-To (sem References) não casa (cliente raro; registrado na nota)');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
