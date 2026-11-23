// 23/11 — um bounce do Gmail (Delivery Status Notification, 550 5.1.1 NoSuchUser) do toque 2 casou pelo References com o
// 1º e-mail e foi tratado como resposta de lead: revisão manual, card no Trello e aviso ao João. Agora: contato inválido e
// bloqueado (motivo 'bounce'), lead fora do follow-up, sem card, sem aviso e sem contar como resposta.
// Endereços e nomes fictícios. Uso: node workflow/tests/bounce.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { ehBounce, dadosBounce };')(CONFIG);
const rodar = (file, { input = [], nodes = {}, prefixo = '' } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + prefixo + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input },
    (n) => { if (!(n in nodes)) throw new Error(`Node '${n}' hasn't been executed`); return { first: () => nodes[n][0], all: () => nodes[n] }; },
    () => ({}), CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

const EMAIL = 'oficinaaurorateste@gmail.com';
const ID1 = '<d0000000-0000-4000-8000-0000000000b1@gmail.com>';
// Texto no formato do aviso do Gmail de 23/11 (pt-BR), com endereço fictício.
const DSN = `** Endereço não encontrado **\n\nSua mensagem não foi entregue a ${EMAIL} porque o endereço não foi encontrado ou não pode receber mensagens.\n\n`
  + 'Saiba mais aqui: https://support.google.com/mail/?p=NoSuchUser\n\nA resposta foi:\n\n550 5.1.1 The email account that you tried to reach does not exist.';

console.log('Reconhecer bounce');
{
  const b = (from, assunto, texto) => lib.ehBounce({ from, assunto, texto });
  ok(b('mailer-daemon@googlemail.com', 'Delivery Status Notification (Failure)', DSN), 'Gmail: mailer-daemon + "Delivery Status Notification" + 5.1.1');
  ok(b('postmaster@provedor-ficticio.com.br', 'Falha na entrega', 'Mensagem não entregue.'), 'postmaster (qualquer assunto)');
  ok(b('avisos@provedor-ficticio.com.br', 'Undelivered Mail Returned to Sender', '550 5.1.1 <x@y.com>: User unknown'), 'assunto "Undelivered" + 5.1.1 (remetente qualquer)');
  ok(b('avisos@provedor-ficticio.com.br', 'Aviso', 'Status: NoSuchUser'), 'corpo com NoSuchUser');
  ok(!b(EMAIL, 'Re: Uma ideia para Oficina Fictícia', 'Tenho interesse, me liga amanhã.'), 'resposta comum de lead não é bounce');
  ok(!b(EMAIL, 'Re: Uma ideia para Oficina Fictícia', 'Esse endereço não existe mais, use o do meu sócio.'), 'lead dizendo que o endereço "não existe" (sem DSN) não é bounce');
  ok(!b(EMAIL, 'Re: Uma ideia', 'Minha mensagem anterior não foi entregue? Reenvio aqui.'), 'lead falando de "não foi entregue" num Re: não é bounce');
  const d = lib.dadosBounce(DSN);
  ok(d.codigo === '550 5.1.1' && d.email === EMAIL && d.nosuchuser === true, `dados do aviso: código "${d.codigo}" e endereço que falhou`);
}

console.log('IMAP: extrair e casar');
const imap = { from: { value: [{ address: 'mailer-daemon@googlemail.com' }] }, subject: 'Delivery Status Notification (Failure)', text: DSN,
  messageId: '<dsn-ficticio.GMR@mx.google.com>', inReplyTo: null, references: `${ID1} <CAO8_ficticio@mail.gmail.com>`, date: '2026-11-23T12:02:47Z' };
const r = rodar('c_extrair_resposta.js', { input: [{ json: imap }] })[0].json;
ok(r.bounce === true && !r.ignorar && r.ids.includes(ID1) && r.bounce_dados.codigo === '550 5.1.1', 'DSN marcado como bounce, com os ids para achar o envio');
const lead = { id: 'L1', nome: 'Oficina Aurora Teste', cidade: 'Vila Exemplo', estado: 'GO', status: 'email_enviado', trello_card_id: null };
const contato = { id: 'C1', email: EMAIL, origem: 'ia_candidato', bloqueado: false };
const env = { id: 'E1', tipo: 'prospeccao', assunto: 'Uma ideia para Oficina Fictícia', corpo: 'x', classificacao_ia: { modelo: 'm' }, teste: false, lead, contato };
const ctx = rodar('c_contexto.js', { input: [{ json: env }], nodes: { 'Extrair resposta': [{ json: r }] } })[0].json;
ok(ctx.acao === 'bounce', 'contexto: acao = bounce (não vai para a IA nem para revisão)');
ok(!('resposta_recebida_em' in ctx.resposta_patch) && !('resposta_texto' in ctx.resposta_patch) && ctx.resposta_patch.classificacao_ia.bounce.codigo === '550 5.1.1'
   && ctx.resposta_patch.classificacao_ia.modelo === 'm', 'o envio NÃO fica como respondido; só ganha classificacao_ia.bounce');
const lead2 = { ...lead, status: 'email_enviado' };
const r2 = rodar('c_contexto.js', { input: [{ json: { ...env, lead: lead2 } }], nodes: { 'Extrair resposta': [{ json: { ...r, bounce: false, texto: 'Pode me ligar.' } }] } })[0].json;
ok(r2.acao === 'qualificar' && r2.resposta_patch.resposta_recebida_em, 'resposta comum continua igual (qualificar, envio respondido)');

console.log('Ramo do bounce');
{
  const d = rodar('c_bounce.js', { nodes: { 'Contexto da resposta': [{ json: ctx }] } })[0].json;
  const row = d.rows[0];
  ok(d.rows.length === 1 && row.email === EMAIL && row.bloqueado === true && row.bloqueado_motivo === 'bounce' && row.reacher_status === 'invalid',
    'contato: inválido e bloqueado, motivo bounce');
  ok(d.lead_patch.status === 'sem_email' && /bounce em 23\/11 \(550 5\.1\.1\)/.test(d.lead_patch.motivo_revisao), 'lead: sem_email (sai do follow-up), motivo com data e código');
  ok(d.trello_lista === null && d.acao_v1 === 'bounce', 'sem card no Trello; acao_v1 = bounce');
  const resp = rodar('c_bounce.js', { nodes: { 'Contexto da resposta': [{ json: { ...ctx, lead: { ...lead, status: 'respondeu' } } }] } })[0].json;
  ok(!('status' in resp.lead_patch) && resp.lead_patch.motivo_revisao, 'lead em outro estágio (ex.: respondeu): não muda o status, só registra o motivo');
  const t = rodar('c_bounce.js', { nodes: { 'Contexto da resposta': [{ json: { ...ctx, envio: { ...ctx.envio, teste: true } } }] } })[0].json;
  ok(!t.rows[0].bloqueado && !('status' in t.lead_patch), 'teste: não bloqueia o contato real nem muda o lead');
  // "Saída (C)" recebe o retorno do upsert e recupera o objeto do nó que rodou ("Dados bounce"; "Dados bloqueio" não rodou).
  const s = rodar('_saida.js', { input: [{ json: { id: 'C1', email: EMAIL } }], nodes: { 'Dados bounce': [{ json: d }] },
    prefixo: "const ORIGEM_FALLBACK = ['Dados bloqueio', 'Dados bounce'];" })[0].json;
  ok(s.acao_v1 === 'bounce' && s.lead_patch.status === 'sem_email', 'Saída (C): pega "Dados bounce" quando "Dados bloqueio" não rodou');
  const s2 = rodar('_saida.js', { input: [{ json: { id: 'x' } }], nodes: { 'Dados bloqueio': [{ json: { lead_patch: { status: 'perdido' }, acao_v1: 'optout' } }] },
    prefixo: "const ORIGEM_FALLBACK = ['Dados bloqueio', 'Dados bounce'];" })[0].json;
  ok(s2.acao_v1 === 'optout', 'Saída (C): SAIR continua igual');
  const s3 = rodar('_saida.js', { input: [{ json: { id: 'x' } }], nodes: { 'Dados (B)': [{ json: { lead_patch: {}, acao_v1: 'b' } }] }, prefixo: "const ORIGEM_FALLBACK = 'Dados (B)';" })[0].json;
  ok(s3.acao_v1 === 'b', 'Saída com origem única (ramo B) continua igual');
}

console.log('Estrutura do workflow');
{
  const w = JSON.parse(readFileSync(`${R}/dist/novax-agente-prospeccao.json`, 'utf8'));
  const no = (n) => w.nodes.find((x) => x.name === n);
  const saidas = (n, i = 0) => (w.connections[n]?.main[i] || []).map((x) => x.node);
  ok(saidas('Registrar resposta no envio')[0] === 'É bounce?' && saidas('É bounce?', 0)[0] === 'Dados bounce' && saidas('É bounce?', 1)[0] === 'É descadastro?',
    'depois de gravar: bounce vai para o ramo próprio; o resto segue para SAIR/IA');
  ok(saidas('Dados bounce')[0] === 'Marcar bounce' && saidas('Marcar bounce')[0] === 'Saída (C)', 'ramo: Dados bounce → Marcar bounce → Saída (C)');
  const mb = no('Marcar bounce');
  ok(/prospeccao_contatos\?on_conflict=email/.test(mb.parameters.url) && mb.retryOnFail, 'Marcar bounce: upsert em prospeccao_contatos, com retry');
  ok(/'Dados bounce'/.test(no('Saída (C)').parameters.jsCode), 'Saída (C) conhece "Dados bounce"');
  ok(/acao === 'bounce' \? 'bounce'/.test(no('Gravar resposta bruta').parameters.jsonBody), 'gravação bruta já entra com acao_v1 = bounce');
  ok(/=== 'revisao_manual'/.test(JSON.stringify(no('Avisar João? (C)').parameters)), 'aviso ao João só para revisão manual (bounce não avisa)');
  ok(/!!\$\('Saída \(C\)'\)\.first\(\)\.json\.trello_lista/.test(JSON.stringify(no('Registrar no Trello? (C)').parameters)), 'sem trello_lista → sem card');
  const wd = JSON.parse(readFileSync(`${R}/dist/novax-robson-watchdog.json`, 'utf8'));
  const resp = wd.nodes.find((x) => x.name === 'W: respostas hoje');
  ok(/prospeccao_respostas\?select=id&teste=is\.false&or=\(acao_v1\.is\.null,acao_v1\.neq\.bounce\)/.test(resp.parameters.url), 'watchdog: conta só respostas de leads (sem bounce, sem teste)');
  const fu = JSON.parse(readFileSync(`${R}/dist/novax-robson-followup.json`, 'utf8'));
  ok(/acao_v1\.neq\.bounce/.test(fu.nodes.find((x) => x.name === 'FU: respostas').parameters.url), 'follow-up: bounce não conta como "respondeu"');
}

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
