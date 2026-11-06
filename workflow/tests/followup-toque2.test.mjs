// 06/11 — sombra de 06/11: (1) o resumo disse "0 texto(s)" com 8 textos gravados, porque $(n).all() sem índice
// devolve só a ÚLTIMA rodada de um nó que roda no loop; (2) o toque 2 repetia o 1º e-mail ("Notei que o perfil …
// aparece sem site … sim ou não?"). Nomes fictícios. Uso: node workflow/tests/followup-toque2.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { checarCorpoFollowup, toque2Abertura, toque2Exemplo, ehVarejo };')(CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

// $ como o do n8n: cada nó guarda uma lista de rodadas; all() sem índice = última rodada; rodada inexistente lança erro.
const proxy = (runs) => (n) => {
  const rs = runs[n] || [];
  const pega = (r) => { const k = r === undefined || r === -1 ? rs.length - 1 : r; if (k < 0 || k >= rs.length) throw new Error(`Run ${k} of node "${n}" not found`); return rs[k]; };
  return { first: () => pega()[0], all: (b, r) => pega(r) };
};
const rodar = (file, runs) => new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
  { first: () => ({ json: {} }), all: () => [] }, proxy(runs), () => ({}), CONFIG)[0].json;

console.log('Resumo da sombra (rodadas do loop)');
const reg = (i, corpo) => [{ json: { registro: { toque: 2, dias_uteis: 8 + (i % 5), assunto: `Re: Empresa Fictícia ${i} em Vila Exemplo`,
  corpo: corpo ? `Texto fictício ${i}.` : null, erro: corpo ? null : 'sem texto (teto da sombra)' } } }];
const runs = {
  'FU: elegíveis': [[{ json: { resumo: { hoje: '2026-11-06', estagio: 'sombra', elegiveis: 51, limite: 20, enviadosHoje: 0, teto: 0 } } }]],
  'FU: registro': Array.from({ length: 51 }, (_, i) => reg(i + 1, i < 8)),
};
const r = rodar('f_resumo.js', runs);
ok(/51 elegíveis, 8 texto\(s\)/.test(r.assunto), `assunto conta os 8 textos de todas as rodadas (${r.assunto})`);
ok(/Registros gravados: 51 \(8 com texto, 43 sem texto pelo teto da sombra, 0 falha\(s\)\)/.test(r.texto), 'corpo: 51 registros, 8 com texto, 43 pelo teto');
ok((r.texto.match(/— Texto \d/g) || []).length === CONFIG.followup.sombraTextosNoEmail && /Textos neste e-mail: 5 de 8/.test(r.texto),
  `corpo traz ${CONFIG.followup.sombraTextosNoEmail} textos e diz quantos ficaram de fora`);
ok(r.texto.includes('Texto fictício 1.') && r.texto.includes('Texto fictício 5.') && !r.texto.includes('Texto fictício 6.'), 'os 5 primeiros textos, na ordem');
// O código antigo, com o mesmo $: só a última rodada (sem texto) → "0 texto(s)". Garante que o teste reproduz o bug.
const antigo = readFileSync(`${R}/code/f_resumo.js`, 'utf8').replace(/todasRodadas\('FU: registro'\)/, "doNo('FU: registro')");
const rAnt = new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + antigo)({}, proxy(runs), () => ({}), CONFIG)[0].json;
ok(/0 texto\(s\)/.test(rAnt.assunto), 'reprodução do bug: só a última rodada → "0 texto(s)"');
// Teste/ligado: envios de todas as rodadas de "FU: resultado".
const env = (s) => [{ json: { envio: { status: s } } }];
const rT = rodar('f_resumo.js', { ...runs, 'FU: elegíveis': [[{ json: { resumo: { hoje: '2026-11-11', estagio: 'teste', elegiveis: 40 } } }]],
  'FU: registro': [], 'FU: resultado': [env('enviado'), env('enviado'), env('erro')] });
ok(/40 elegíveis, 2 enviado\(s\)/.test(rT.assunto) && /Enviados: 2 de 3/.test(rT.texto), `teste: conta envios de todas as rodadas (${rT.assunto})`);
const rV = rodar('f_resumo.js', { 'FU: elegíveis': [[{ json: { resumo: { hoje: '2026-11-09', estagio: 'sombra', elegiveis: 0 } } }]] });
ok(/0 elegíveis, 0 texto\(s\)/.test(rV.assunto), 'dia sem elegíveis (nós do loop nunca rodaram) não quebra');

console.log('Validador do toque 2 (regras do João, 06/11)');
const oficina = { id: 'f1', nome: 'Oficina Aurora', cidade: 'Vila Exemplo', estado: 'GO', tipo_google: 'Mecânica para carros',
  tipos_google: ['car_repair', 'service'], nicho: 'oficina_mecanica', rating: 4.8, total_avaliacoes: 31 };
const ant = ['Olá! Sou o João, da Novax. Pesquisei oficinas mecânicas em Vila Exemplo no Google e o perfil de Oficina Aurora (nota 4,8, 31 avaliações) apareceu sem site.'];
const err = (t) => lib.checarCorpoFollowup(t, oficina, 2, ant).join(' | ');
// Estilo dos textos de 06/11, com nome fictício.
const velho = 'Notei que o perfil da Oficina Aurora no Google aparece sem site, embora tenha nota 4,8, 31 avaliações. A Novax pode criar uma página simples com atendimento automático pelo WhatsApp. Você quer que eu envie uma sugestão, sim ou não?';
const e = err(velho);
ok(/repete o argumento do 1º e-mail/.test(e), '(a) "perfil … sem site" de novo → reprovado');
ok(/nota X, N avaliações/.test(e), '(b) "nota 4,8, 31 avaliações" → reprovado');
ok(/sim ou não/.test(e), '(c) "sim ou não" → reprovado');
ok(/varie a abertura/.test(e), '(d) abrir com "Notei que" → reprovado');
ok(/varie a abertura/.test(err('Vi que a Oficina Aurora atende em Vila Exemplo. Imagine um cliente que manda o modelo do carro pelo WhatsApp à noite e já recebe resposta. Posso te mostrar como ficaria?')), '(d) "Vi que" também');
const bom = 'Imagine um cliente com o carro fazendo barulho às 21h: ele manda o modelo pelo WhatsApp, recebe resposta na hora e já combina o dia de levar o carro na Oficina Aurora. Posso te mandar um exemplo de como ficaria?';
ok(err(bom) === '', 'toque 2 com exemplo do dia a dia passa');
ok(err(bom.replace('na Oficina Aurora.', 'na Oficina Aurora, que tem nota 4,8 com 31 avaliações.')) === '', '(b) "nota 4,8 com 31 avaliações" passa');
ok(/sim ou não/.test(lib.checarCorpoFollowup('Esta é a minha última mensagem sobre o site da Oficina Aurora. Se não fizer sentido agora, sem problema; posso encerrar, sim ou não?', oficina, 3, ant).join()), '(c) "sim ou não" reprova também no toque 3');

console.log('Prompt do toque 2');
const pedido = (lead) => {
  const it = { lead, toque: 2, anteriores: ant };
  return new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/f_pedido_ia.js`, 'utf8'))(
    { first: () => ({ json: {} }) }, (n) => ({ first: () => ({ json: it }) }), () => ({}), CONFIG)[0].json.messages[0].content;
};
const p = pedido(oficina);
ok(/NÃO repita isso/.test(p) && /ângulo NOVO/.test(p) && !/lembre o fato verificável/.test(p), '(a) pede ângulo novo e proíbe repetir "sem site"');
ok(/carro/.test(p), '(a) exemplo concreto para oficina (carro)');
ok(p.includes('"nota 4,8 com 31 avaliações"') && !/nota 4,8, 31/.test(p), '(b) formato "nota X com N avaliações"');
ok(/Nunca escreva "sim ou não"/.test(p) && !/pergunta direta de sim ou não/.test(p), '(c) proíbe "sim ou não"');
ok(/Abertura: comece/.test(p), '(d) abertura sugerida no prompt');
const aberturas = new Set(Array.from({ length: 40 }, (_, i) => lib.toque2Abertura({ id: `lead-${i}` })));
ok(aberturas.size >= 3, `(d) aberturas variam entre leads (${aberturas.size} estilos em 40 leads)`);
ok(lib.toque2Abertura({ id: 'lead-7' }) === lib.toque2Abertura({ id: 'lead-7' }), '(d) mesma abertura no retry do mesmo lead');
const loja = { id: 'f2', nome: 'Casa Fictícia Ferragens', tipo_google: 'Loja de ferramentas', tipos_google: ['hardware_store', 'store'], nicho: 'material_construcao' };
ok(/produto/.test(lib.toque2Exemplo(loja, lib.ehVarejo(loja))) && !/agend|marcad/.test(lib.toque2Exemplo(loja, true)), 'loja: exemplo de produto, sem agendamento');

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
