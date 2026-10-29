// Copy v2 (12/10/2026): primeiro e-mail curto, de uma pessoa para outra, com pedido de sim ou não; assunto em 4 formatos
// sorteados pelo código; assinatura "João Novais". Dados FICTÍCIOS (o repositório é público). Offline.
// Uso: node workflow/tests/copy-v2.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { formatoAssunto, montarAssunto, nomeExibicao, nomeSugerePlural, checarAssuntoV2, checarCorpoV2, assuntoPadrao, nomeCurtoAssunto, normalizarCaixa, rodapeLGPD, textoParaHtml };')(CONFIG);
const rodar = (file, { input = [], nodes = {}, staticData = {} } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', '$execution', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }),
    () => staticData, { id: 'teste' }, CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };
const validar = (lead, obj) => rodar('b_validar_ia.js', {
  input: [{ json: { model: 'teste', choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }] } }],
  nodes: { 'Pedido IA - e-mail': [{ json: { lead: { ...lead, fila: { modo: 'texto' } }, tentativa: 1, messages: [] } }] },
})[0].json;
const palavras = (t) => t.trim().split(/\s+/).length;

// Seis leads fictícios, de ramos diferentes; os ids foram escolhidos para cobrir os 4 formatos de assunto.
const lead = (id, nome, cidade, rating, total, tipo, nicho) => ({ id, nome, cidade, estado: 'GO', rating, total_avaliacoes: total,
  tipo_google: tipo, tipos_google: [], nicho });
const BONS = [
  { lead: lead('ficticio-01', 'Exemplo Advocacia', 'Cidade Exemplo', 4.4, 29, 'Advogado', 'advocacia'),
    assunto: 'Uma ideia para Exemplo Advocacia',
    corpo: 'Olá! Sou o João, da Novax. Pesquisei escritórios de advocacia em Cidade Exemplo no Google e o perfil do Exemplo Advocacia '
      + '(nota 4,4, 29 avaliações) apareceu sem site, então quem quer ver áreas de atuação ou agendar uma consulta não tem para onde ir.\n\n'
      + 'A Novax cria sites simples para escritórios, com agendamento e resposta automática pelo WhatsApp. '
      + 'Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para o Exemplo Advocacia?' },
  { lead: lead('ficticio-04', 'Auto Center Fictício', 'Vila Modelo', 4.7, 58, 'Oficina mecânica', 'oficina_mecanica'),
    assunto: 'Auto Center Fictício no Google de Vila Modelo',
    corpo: 'Olá! Sou o João, da Novax. Pesquisei oficinas mecânicas em Vila Modelo no Google e o perfil do Auto Center Fictício '
      + '(nota 4,7, 58 avaliações) apareceu sem site. Quem procura revisão ou troca de óleo quer ver os serviços, o endereço e um jeito '
      + 'rápido de pedir orçamento. A Novax cria sites simples para oficinas, com botão de WhatsApp e agendamento de horário. '
      + 'Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para o Auto Center Fictício?' },
  { lead: lead('ficticio-05', 'Pet Shop Patinhas Fictícias', 'Morro Exemplo', 4.9, 12, 'Pet shop', 'pet_veterinaria'),
    assunto: 'Pergunta rápida sobre Pet Shop Patinhas Fictícias',
    corpo: 'Olá! Sou o João, da Novax. Pesquisei pet shops em Morro Exemplo no Google e o perfil do Pet Shop Patinhas Fictícias '
      + '(nota 4,9, 12 avaliações) apareceu sem site. Um site simples mostraria os serviços de banho e tosa, o endereço e o horário, '
      + 'com um botão de WhatsApp para agendar. Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para o Pet Shop Patinhas Fictícias?' },
  // Poucas avaliações (< minAvaliacoesParaCitarNota): sem nota nem quantidade.
  { lead: lead('ficticio-09', 'Studio Bela Exemplo', 'Serra Fictícia', 5, 6, 'Salão de beleza', 'salao_barbearia'),
    assunto: 'Sobre o perfil de Studio Bela Exemplo no Google',
    corpo: 'Olá! Sou o João, da Novax. Pesquisei salões de beleza em Serra Fictícia no Google e o perfil do Studio Bela Exemplo apareceu '
      + 'sem site. Quem quer marcar um corte ou uma escova costuma procurar os serviços, o endereço e um jeito rápido de agendar. '
      + 'A Novax cria sites simples para salões, com agenda online e resposta automática pelo WhatsApp. '
      + 'Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para o Studio Bela Exemplo?' },
  // Nome com mais de 4 palavras: a IA usa a forma curta ("Casa Fictícia"), só com palavras do nome.
  { lead: lead('ficticio-10', 'Casa Fictícia Materiais de Construção', 'Ponte Exemplo', 4.5, 33, 'Loja de materiais de construção', 'material_construcao'),
    assunto: 'Pergunta rápida sobre Casa Fictícia',
    corpo: 'Olá! Sou o João, da Novax. Pesquisei lojas de material de construção em Ponte Exemplo no Google e o perfil da Casa Fictícia '
      + '(nota 4,5, 33 avaliações) apareceu sem site. Um site simples mostraria o que a loja vende, o endereço e o horário, com um botão '
      + 'de WhatsApp para pedir orçamento. Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para a Casa Fictícia?' },
  // Nome que indica mais de uma pessoa: "vocês" é permitido.
  { lead: lead('ficticio-11', 'Fictício & Associados Contabilidade', 'Lago Exemplo', 4.6, 41, 'Contador', 'contabilidade'),
    assunto: 'Sobre o perfil de Fictício & Associados Contabilidade no Google',
    corpo: 'Olá! Sou o João, da Novax. Pesquisei escritórios de contabilidade em Lago Exemplo no Google e o perfil da Fictício & Associados '
      + 'Contabilidade (nota 4,6, 41 avaliações) apareceu sem site. Um site simples mostraria os serviços, o endereço e um botão de WhatsApp '
      + 'para quem quer abrir uma empresa ou tirar uma dúvida. Faz sentido eu explicar a vocês, em poucas linhas, como isso funcionaria para a Fictício & Associados Contabilidade?' },
];

console.log('Config');
ok(CONFIG.remetente.nomePessoa === 'João', 'remetente.nomePessoa = "João"');
ok(CONFIG.remetente.assinatura === 'João Novais\nNovax · novax.ia.br | instagram.com/novax.ia.br', 'assinatura de pessoa');
ok(CONFIG.assuntoFormatos.length === 4 && BONS.every((b) => !lib.checarAssuntoV2(b.assunto, b.lead).some((e) => /config/.test(e))),
   '4 formatos de assunto no config, todos com 3 a 7 palavras (nome e cidade contam 1)');
ok(CONFIG.corpoLimites.palavrasMin === 55 && CONFIG.corpoLimites.palavrasMax === 95 && CONFIG.corpoLimites.caracteresMin === 300
   && CONFIG.corpoLimites.caracteresMax === 900, 'limites do corpo: 55-95 palavras, 300-900 caracteres');
ok(!/presença digital|profissional/i.test(CONFIG.oferta), 'oferta (vai no prompt) sem "presença digital" nem "profissional"');

console.log('Textos novos bons passam (6 ramos)');
ok(new Set(BONS.map((b) => lib.formatoAssunto(b.lead))).size === 4, 'os 6 leads cobrem os 4 formatos de assunto');
for (const b of BONS) {
  const v = validar(b.lead, { assunto: b.assunto, corpo: b.corpo });
  ok(v.ok === true && v.assunto_corrigido === false && v.assunto === b.assunto,
     `${b.lead.tipo_google}: aprovado (${palavras(b.corpo)} palavras, ${b.corpo.length} caracteres)${v.ok ? '' : ' — ' + v.erro}`);
}

console.log('Cada regra nova do corpo reprova');
const B = BONS[0];
const corpoErros = (corpo, l = B.lead) => lib.checarCorpoV2(corpo, l).join(' | ');
const reprova = (corpo, re, msg, l = B.lead) => {
  const v = validar(l, { assunto: B.assunto, corpo });
  ok(v.ok === false && re.test(v.erro), msg + (v.ok ? ' (passou!)' : ''));
};
reprova(B.corpo.replace('Olá! Sou o João, da Novax.', 'Olá, vi que o Google mostra pouco. Sou o João, da Novax.'), /abertura antiga/, 'abertura "Olá, vi que"');
reprova(B.corpo.replace('Olá! Sou o João, da Novax.', 'Olá, equipe! Sou o João, da Novax.'), /abertura antiga/, 'abertura "Olá, equipe"');
reprova(B.corpo.replace('Olá! Sou o João, da Novax.', 'Olá! Aqui é da Novax.'), /primeira pessoa/, 'sem primeira pessoa ("Sou o João")');
reprova(B.corpo.replace(/Faz sentido.*\?$/, 'Posso te mostrar isso em 30 minutos, online?'), /duração/, '"30 minutos"');
reprova(B.corpo.replace(/Faz sentido.*\?$/, 'Podemos marcar uma reunião de diagnóstico?'), /reunião de diagnóstico/, '"reunião de diagnóstico"');
reprova(B.corpo.replace(/Faz sentido.*\?$/, 'Podemos marcar uma reunião rápida?'), /reunião no primeiro contato/, 'qualquer pedido de reunião no primeiro toque');
reprova(B.corpo.replace('Faz sentido eu te explicar', 'Faz sentido eu explicar a vocês'), /vocês/, 'plural ("vocês") num nome de uma pessoa/empresa só');
reprova(B.corpo.replace(/Faz sentido.*\?$/, 'Posso convidá-los para conversar sobre o Exemplo Advocacia?'), /gênero/, 'plural com gênero ("convidá-los")');
reprova(B.corpo.replace(/Faz sentido.*\?$/, 'Posso convidá-lo para conversar sobre o Exemplo Advocacia?'), /gênero/, 'singular com gênero ("convidá-lo")');
reprova(B.corpo.replace('Olá!', 'Prezado(a),'), /gênero/, '"Prezado(a)"');
reprova(B.corpo.replace(/\?$/, '.'), /pergunta de sim ou não/, 'não termina com a pergunta');
for (const t of ['essa lacuna', 'isso dificulta', 'um site resolveria', 'uma conversa gratuita', 'Gostaria de ajudar', 'presença digital', 'um site profissional', 'sites profissionais'])
  reprova(B.corpo.replace('A Novax cria sites simples', `A Novax cria (${t}) sites simples`), /contém/, `termo proibido: "${t}"`);
const curto40 = 'Olá! Sou o João, da Novax. Vi o perfil do Exemplo Advocacia em Cidade Exemplo no Google sem site. Um site mostraria '
  + 'as áreas de atuação e o endereço. Faz sentido eu te explicar como funcionaria para o Exemplo Advocacia?';
ok(palavras(curto40) === 40 && /40 palavras/.test(corpoErros(curto40)), `40 palavras → reprovado (${corpoErros(curto40)})`);
const longo120 = B.corpo.replace('A Novax cria sites simples para escritórios, com agendamento e resposta automática pelo WhatsApp.',
  'A Novax cria sites simples para escritórios, com as áreas de atuação explicadas em linguagem clara, o endereço com mapa, o horário '
  + 'de atendimento, um botão de WhatsApp que leva direto para a conversa, a agenda de consultas que mostra os horários livres e uma '
  + 'resposta automática que avisa quem escreveu fora do expediente quando o escritório vai retornar o contato.');
ok(palavras(longo120) === 120 && /120 palavras/.test(corpoErros(longo120)), `120 palavras → reprovado (${palavras(longo120)} palavras)`);
ok(/mais de 2 parágrafos/.test(corpoErros(B.corpo.replace('. Pesquisei', '.\n\nPesquisei'))), '3 parágrafos → reprovado');
ok(/frases/.test(corpoErros(B.corpo.replace(' Faz sentido', ' É rápido. É simples. É claro. Faz sentido'))), '7 frases → reprovado');
ok(!/frases/.test(corpoErros(B.corpo.replace('Exemplo Advocacia (nota', 'Exemplo Advocacia, da Dra. Fictícia (nota'))), '"Dra." não conta como fim de frase');
ok(/nota|avalia/.test(corpoErros(BONS[3].corpo.replace('apareceu sem site', '(nota 5,0, 6 avaliações) apareceu sem site'), BONS[3].lead))
   || validar(BONS[3].lead, { assunto: BONS[3].assunto, corpo: BONS[3].corpo.replace('apareceu sem site', '(nota 5,0, 6 avaliações) apareceu sem site') }).ok === false,
   'poucas avaliações: citar nota continua reprovado (regra antiga mantida)');
const antigo = 'Olá, vi que a Exemplo Advocacia, em Cidade Exemplo, tem nota 4,4 com 29 avaliações no Google, mas não possui um site vinculado '
  + 'ao perfil. Isso dificulta que clientes encontrem as áreas de atuação ou agendem uma consulta. Um site profissional resolveria essa lacuna, '
  + 'reunindo informações e um canal de contato. Gostaria de convidá-los para uma reunião de diagnóstico gratuita de 30 minutos, online.';
const vAnt = validar(B.lead, { assunto: 'Exemplo Advocacia em Cidade Exemplo tem nota 4,4', corpo: antigo });
ok(vAnt.ok === false && ['abertura antiga', 'lacuna', 'dificulta', 'resolveria', '30 minutos', 'gratuita', 'Gostaria', 'profissional', 'gênero', 'primeira pessoa']
  .every((k) => vAnt.erro.includes(k)), 'texto no molde antigo (fictício) reprovado por todas as regras novas');
ok(validar(B.lead, { assunto: B.assunto, corpo: B.corpo.replace('sites simples', 'sites excelentes') }).ok === false, 'regras antigas continuam (elogio)');
ok(validar(B.lead, { assunto: B.assunto, corpo: B.corpo.replace('nota 4,4', 'nota 4,5') }).ok === false, 'regras antigas continuam (nota errada)');
ok(validar(B.lead, { assunto: B.assunto, corpo: B.corpo.replace('não tem', 'nao tem') }).ok === false, 'regras antigas continuam (acentuação)');

console.log('Assunto');
const assErros = (a, l = B.lead) => lib.checarAssuntoV2(a, l).join(' | ');
for (const b of BONS) ok(!assErros(b.assunto, b.lead), `"${b.assunto}" no formato sorteado`);
ok(/nota/.test(assErros('Exemplo Advocacia tem nota 4,4')), 'nota no assunto → reprovado');
ok(/nota/.test(assErros('Uma ideia para Exemplo Advocacia, 29 avaliações')), 'avaliações no assunto → reprovado');
ok(/padrão antigo/.test(assErros('Exemplo Advocacia em Cidade Exemplo pode aparecer com site no Google')), '"pode aparecer" → reprovado');
ok(/padrão antigo/.test(assErros('Exemplo Advocacia sem site no Google')), '"sem site" → reprovado');
ok(/exclamação/.test(assErros('Uma ideia para Exemplo Advocacia!')), 'exclamação → reprovado');
ok(/emoji/.test(assErros('Uma ideia para Exemplo Advocacia 🚀')), 'emoji → reprovado');
ok(/CAIXA ALTA/.test(assErros('UMA IDEIA para Exemplo Advocacia')), 'CAIXA ALTA → reprovado');
ok(/formato sorteado/.test(assErros('Pergunta rápida sobre Exemplo Advocacia')), 'outro formato que não o sorteado → reprovado');
ok(/formato sorteado/.test(assErros('Pergunta rápida sobre Casa Ideal', BONS[4].lead)), 'forma curta com palavra inventada → reprovado');
ok(/formato sorteado/.test(assErros('Pergunta rápida sobre Casa Fictícia Materiais de Construção', BONS[4].lead)), 'nome com mais de 4 palavras no assunto → reprovado');
ok(!assErros('Uma ideia para o Exemplo Advocacia'), 'artigo antes do nome é aceito');
{
  const v = validar(B.lead, { assunto: 'Exemplo Advocacia em Cidade Exemplo tem nota 4,4', corpo: B.corpo });
  ok(v.ok === true && v.assunto_corrigido === true && v.assunto === 'Uma ideia para Exemplo Advocacia',
     'nome até 4 palavras: assunto reprovado é trocado pelo formato sorteado, sem nova chamada');
  const v2 = validar(BONS[4].lead, { assunto: 'Casa Fictícia Materiais de Construção tem nota 4,5', corpo: BONS[4].corpo });
  // 21/10: a forma curta agora é do código (nomeCurtoAssunto) → o assunto reprovado também é corrigido, sem nova chamada.
  ok(v2.assunto_corrigido === true && v2.assunto === lib.assuntoPadrao(BONS[4].lead) && !/assunto/.test(v2.erro || ''),
     'nome com mais de 4 palavras: assunto reprovado é trocado pelo formato sorteado com a forma curta do código, sem nova chamada');
  const v3 = validar(B.lead, { assunto: 'Uma ideia para EXEMPLO ADVOCACIA', corpo: B.corpo });
  ok(v3.ok === true && v3.assunto === 'Uma ideia para Exemplo Advocacia', 'palavra inteira em maiúsculas é normalizada antes de validar (sem nova chamada)');
  const caixa = { ...B.lead, nome: 'ADVOCACIA EXEMPLO FICTÍCIA', id: 'ficticio-01' };
  ok(lib.assuntoPadrao(caixa) === 'Uma ideia para Advocacia Exemplo Fictícia', 'nome em CAIXA ALTA vira "Advocacia Exemplo Fictícia" no assunto montado');
  ok(!assErros(lib.assuntoPadrao(caixa), caixa), 'assunto montado de nome em CAIXA ALTA passa');
}

console.log('Sorteio do formato do assunto');
{
  const ids = Array.from({ length: 1000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const cont = {};
  for (const id of ids) { const f = lib.formatoAssunto({ id }); cont[f] = (cont[f] || 0) + 1; }
  ok(ids.every((id) => lib.formatoAssunto({ id }) === lib.formatoAssunto({ id: String(id) })), 'determinístico (mesmo id → mesmo formato)');
  ok(Object.keys(cont).length === 4 && Object.values(cont).every((n) => n >= 150),
     `1.000 ids: os 4 formatos com ≥ 15% cada (${Object.values(cont).join(' / ')})`);
  const p1 = rodar('b_pedido_ia.js', { input: [{ json: { lead: { ...B.lead, fila: { modo: 'texto' } } } }] })[0].json.messages[0].content;
  const p2 = rodar('b_pedido_ia.js', { input: [{ json: { lead: { ...B.lead, fila: { modo: 'texto' } } } }] })[0].json.messages[0].content;
  ok(p1 === p2 && p1.includes('copie EXATAMENTE este texto') && p1.includes('"Uma ideia para Exemplo Advocacia"'), 'prompt recebe o assunto pronto e a ordem de copiar exatamente');
}

console.log('Prompt');
{
  const prompt = (l) => rodar('b_pedido_ia.js', { input: [{ json: { lead: { ...l, fila: { modo: 'texto' } } } }] })[0].json.messages[0].content;
  const p = prompt(B.lead);
  ok(p.includes('Comece exatamente com "Olá! Sou o João, da Novax."'), 'abertura em primeira pessoa com o nome do config');
  ok(p.includes('"Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para Exemplo Advocacia?"'), 'pedido final de sim ou não');
  ok(p.includes('"(nota 4,4, 29 avaliações)"'), 'nota e avaliações exatas, uma vez');
  ok(!/Convide para uma reunião|Mencione concretamente a lacuna/.test(p), 'sem o convite para reunião nem a "lacuna" do prompt antigo');
  ok(/NÃO use: .*"lacuna".*"30 minutos".*"gratuita".*"Gostaria de".*"presença digital"/.test(p), 'lista do que não usar');
  ok(/Exemplo do tom/.test(p) && /Nunca "vocês"/.test(p), 'um exemplo bom e tratamento singular');
  const pl = prompt(BONS[5].lead);
  ok(pl.includes('Faz sentido eu explicar a vocês') && /Trate por "vocês"/.test(pl), 'nome plural → "vocês"');
  const pb = prompt(BONS[3].lead);
  ok(/NÃO cite nota, estrelas nem número de avaliações/.test(pb), 'poucas avaliações → não cita nota');
  const plg = prompt(BONS[4].lead);
  ok(!plg.includes('{nome curto}') && plg.includes(`"${lib.assuntoPadrao(BONS[4].lead)}"`) && plg.includes(`use a forma "${lib.nomeCurtoAssunto(BONS[4].lead)}"`),
     'nome com mais de 4 palavras → prompt já recebe a forma curta do código (a IA não escolhe)');
  ok(lib.nomeCurtoAssunto({ nome: 'Prime Espaço Fictício | Implantes dentários | Protocolo' }) === 'Prime Espaço Fictício', 'forma curta corta no separador');
  ok(lib.nomeCurtoAssunto({ nome: 'Escritório de Advocacia Dra. Exemplo Fictícia Silva' }) === 'Escritório de Advocacia', 'forma curta não termina em título nem conectivo');
  ok(lib.normalizarCaixa('MS Clinic & BEAUTY') === 'MS Clinic & Beauty', 'caixa: só palavras de 4+ letras; siglas curtas ficam');
  ok(!/cita nota/.test(lib.checarAssuntoV2(lib.assuntoPadrao({ id: 'z', nome: 'Clínica 3D Fictícia', cidade: 'Vila Exemplo' }), { id: 'z', nome: 'Clínica 3D Fictícia', cidade: 'Vila Exemplo' }).join()), 'dígito do próprio nome não conta como nota');
}

console.log('E-mail montado: assinatura nova e rodapé de LGPD idêntico');
{
  const l = B.lead;
  const e = { lead: l, email: 'contato@exemplo.com', assunto: B.assunto, corpo: B.corpo, reacher: null, origem: 'texto' };
  const m = rodar('b_montar_email.js', { input: [], nodes: { 'E-mail definido': [{ json: e }] } })[0].json;
  const rodapeAntigo = `\n\n—\nVocê recebeu esta mensagem porque ${l.nome} aparece como empresa no Google Maps em ${l.cidade}/${l.estado}. `
    + 'Se não quiser receber novos contatos da Novax, responda com a palavra SAIR e removemos seu e-mail imediatamente.';
  ok(m.texto === B.corpo + '\n\nJoão Novais\nNovax · novax.ia.br | instagram.com/novax.ia.br' + rodapeAntigo, 'texto = corpo + assinatura nova + rodapé de LGPD de antes');
  ok(!m.texto.includes('Equipe Novax'), 'sem "Equipe Novax"');
  ok(m.html.includes('<a href="https://novax.ia.br">novax.ia.br</a>') && m.html.includes('<a href="https://instagram.com/novax.ia.br">instagram.com/novax.ia.br</a>'),
     'links da assinatura continuam no HTML');
  const ctx = { lead: l, resposta: { from: 'contato@exemplo.com', texto: 'Sim, pode explicar.' }, envio: { assunto: B.assunto, corpo: B.corpo, classificacao_ia: {} } };
  const h = rodar('c_horarios.js', { input: [{ json: { calendars: { primary: { busy: [] } } } }],
    nodes: { 'Contexto da resposta': [{ json: ctx }], 'Decidir próxima ação': [{ json: { q: { resposta_sugerida: 'Claro! Funciona assim.' } } }] } })[0].json;
  ok(h.texto.endsWith(CONFIG.remetente.assinatura) && !/reunião de diagnóstico/.test(h.texto), 'proposta de horários: assinatura nova, sem "a reunião de diagnóstico"');
  const c = rodar('c_confirmacao.js', { input: [{ json: { id: 'ev1', hangoutLink: 'https://meet.example/abc' } }],
    nodes: { 'Contexto da resposta': [{ json: ctx }], 'Decidir próxima ação': [{ json: { slot: { label: 'terça, 14/10 às 10:30' } } }] } })[0].json;
  ok(c.texto.endsWith(CONFIG.remetente.assinatura), 'confirmação: assinatura nova');
  const q = rodar('c_pedido_ia.js', { input: [{ json: {} }], nodes: { 'Contexto da resposta': [{ json: ctx }] } })[0].json.messages[0].content;
  ok(!/reforçando o convite/.test(q) && /não falou de reunião/.test(q) && /responde "sim" à pergunta do e-mail/.test(q),
     'qualificação da resposta coerente com o primeiro e-mail sem reunião');
}

console.log(`\nfalhas: ${falhas}`);
process.exit(falhas ? 1 : 0);
