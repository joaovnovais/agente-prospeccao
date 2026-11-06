// 05/11 — 1ª resposta real: uma agropecuária (tipo Google pet_store/store) recebeu "serviços do pet shop" e "agendamentos"
// e respondeu "não tenho banho e tosa… tenho 2 mil itens". Loja/varejo → produtos, catálogo e WhatsApp.
// Caso reproduzido com nome fictício. Uso: node workflow/tests/texto-varejo.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const CONFIG = JSON.parse(readFileSync(`${R}/config.json`, 'utf8'));
const LIB = readFileSync(`${R}/code/_lib.js`, 'utf8');
const lib = new Function('CONFIG', LIB + '; return { ehVarejo, checarCorpoV2, checarCorpoFollowup };')(CONFIG);
const rodar = (file, { input = [], nodes = {} } = {}) =>
  new Function('$input', '$', '$getWorkflowStaticData', 'CONFIG', LIB + '\n' + readFileSync(`${R}/code/${file}`, 'utf8'))(
    { first: () => input[0], all: () => input }, (n) => ({ first: () => (nodes[n] || [])[0], all: () => nodes[n] || [] }), () => ({}), CONFIG);
let falhas = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) falhas++; };

// Fictício, com o mesmo perfil do caso real (pet_store, nota 5,0, 16 avaliações, sem site).
const loja = { id: 'L1', nome: 'Bichoverde Agropecuária', cidade: 'Vila Exemplo', estado: 'GO', nicho: 'pet_veterinaria',
  tipo_google: 'Pet Shop', tipos_google: ['pet_store', 'store', 'point_of_interest', 'establishment'], rating: 5, total_avaliacoes: 16,
  fila: { modo: 'texto' } };

console.log('Quem é loja (pelo tipo do Google)');
const casos = [
  [loja, true, 'pet_store/store ("Pet Shop")'],
  [{ tipo_google: 'Loja de material de construção', tipos_google: ['hardware_store', 'store'] }, true, 'material de construção (hardware_store)'],
  [{ tipo_google: 'Agropecuária', tipos_google: [] }, true, '"Agropecuária" só no nome do tipo'],
  [{ tipo_google: 'Loja de roupas', tipos_google: ['clothing_store'] }, true, 'loja de roupas'],
  [{ tipo_google: 'Ótica', tipos_google: ['store'] }, true, 'ótica'],
  [{ tipo_google: 'Veterinário', tipos_google: ['veterinary_care', 'pet_store'] }, false, 'veterinário (tipo principal de serviço vence pet_store)'],
  [{ tipo_google: 'Pet Shop', tipos_google: ['pet_store', 'pet_care', 'store', 'service'] }, false, 'pet shop com pet_care (banho e tosa segundo o Google) → serviço'],
  [{ tipo_google: 'Loja de materiais de construção', tipos_google: ['building_materials_store', 'store', 'service'] }, true, 'tipo genérico "service" não tira da categoria loja'],
  [{ tipo_google: 'Salão de Beleza', tipos_google: ['beauty_salon', 'cosmetics_store', 'store'] }, false, 'salão que também vende cosméticos → serviço'],
  [{ nome: 'Fictícia Contabilidade Ltda', nicho: 'contabilidade', tipo_google: 'Loja', tipos_google: ['store'] }, false, 'contabilidade marcada só como "Loja" genérica → serviço (nome e nicho)'],
  [{ nome: 'Studio Fictício', nicho: 'salao_barbearia', tipo_google: 'Loja', tipos_google: ['store'] }, false, 'nicho de serviço com "store" genérico → serviço'],
  [{ nome: 'Cheiro Fictício Cosméticos', nicho: 'salao_barbearia', tipo_google: 'Loja de cosmético', tipos_google: ['cosmetics_store', 'store'] }, true, 'nicho de serviço com loja específica (cosmetics_store) → loja'],
  [{ tipo_google: 'Dentista', tipos_google: ['dentist'] }, false, 'dentista'],
  [{ tipo_google: 'Oficina mecânica', tipos_google: ['car_repair'] }, false, 'oficina'],
  [{ tipo_google: 'Salão de beleza', tipos_google: ['beauty_salon'] }, false, 'salão'],
  [{ tipo_google: null, tipos_google: null, nicho: 'material_construcao' }, true, 'lead antigo sem tipo, nicho material_construcao'],
  [{ tipo_google: null, tipos_google: null, nicho: 'odontologia_estetica' }, false, 'lead antigo sem tipo, nicho de serviço'],
];
for (const [l, esp, nome] of casos) ok(lib.ehVarejo(l) === esp, `${nome} → ${esp ? 'loja' : 'serviço'}`);

console.log('Validador do primeiro e-mail (caso real)');
const real = 'Olá! Sou o João, da Novax. Pesquisei pet shops em Vila Exemplo no Google e o perfil de Bichoverde Agropecuária (nota 5,0, 16 avaliações) apareceu sem site. Um site simples pode mostrar o endereço e o horário, apresentar os serviços do pet shop, incluir um botão de WhatsApp e permitir agendamentos.\n\nFaz sentido eu te explicar, em poucas linhas, como isso funcionaria para Bichoverde Agropecuária?';
const eReal = lib.checarCorpoV2(real, loja).join(' | ');
ok(/presume serviço\/agendamento numa loja/.test(eReal) && /loja sem menção a produtos/.test(eReal), 'o texto que saiu em 05/11 agora é reprovado (serviços/agendamentos, sem produtos)');
const bom = 'Olá! Sou o João, da Novax. Pesquisei lojas agropecuárias em Vila Exemplo no Google e o perfil de Bichoverde Agropecuária (nota 5,0, 16 avaliações) apareceu sem site. Um site simples pode mostrar as principais categorias de produtos, o endereço e o horário, com um botão de WhatsApp para dúvidas e pedidos.\n\nFaz sentido eu te explicar, em poucas linhas, como isso funcionaria para Bichoverde Agropecuária?';
ok(lib.checarCorpoV2(bom, loja).length === 0, 'texto de loja com produtos, catálogo e WhatsApp passa');
ok(/presume serviço/.test(lib.checarCorpoV2(bom.replace('dúvidas e pedidos', 'dúvidas e reservas'), loja).join()), '"reservas" numa loja também reprova');
const dentista = { nome: 'Clínica Sorriso Fictícia', cidade: 'Vila Exemplo', estado: 'GO', tipo_google: 'Dentista', tipos_google: ['dentist'], rating: 4.8, total_avaliacoes: 40 };
const txtDent = 'Olá! Sou o João, da Novax. Pesquisei dentistas em Vila Exemplo no Google e o perfil de Clínica Sorriso Fictícia (nota 4,8, 40 avaliações) apareceu sem site. Um site simples pode mostrar os serviços, o endereço e o horário, com um botão de WhatsApp e agendamento de consultas.\n\nFaz sentido eu te explicar, em poucas linhas, como isso funcionaria para Clínica Sorriso Fictícia?';
ok(lib.checarCorpoV2(txtDent, dentista).length === 0, 'serviço (dentista) continua podendo falar de serviços e agendamento');

console.log('Prompt do primeiro e-mail');
const pedido = (lead) => rodar('b_pedido_ia.js', { input: [{ json: { lead } }] })[0].json.messages[0].content;
const pLoja = pedido(loja), pDent = pedido({ ...dentista, fila: { modo: 'texto' } });
ok(/É uma LOJA: NÃO fale de serviços, agendamento/.test(pLoja) && /categorias \(catálogo\)/.test(pLoja), 'loja: frase 3 de produtos/catálogo/WhatsApp e proibição explícita de serviço/agendamento');
ok(pLoja.includes(CONFIG.ofertaVarejo) && !pLoja.includes('agenda horários 24h'), 'loja: oferta de loja (sem "agenda horários")');
ok(/Exemplo Agropecuária/.test(pLoja) && !/Exemplo Advocacia/.test(pLoja), 'loja: exemplo fictício de agropecuária');
const exLoja = JSON.parse(pLoja.split('Exemplo do tom (empresa fictícia, não copie os dados):\n')[1]);
ok(lib.checarCorpoV2(exLoja.corpo, { ...loja, nome: 'Exemplo Agropecuária', rating: 4.7, total_avaliacoes: 22, cidade: 'Cidade Exemplo' }).length === 0,
  'o exemplo de loja passa no próprio validador (a IA não aprende um erro)');
ok(!/É uma LOJA/.test(pDent) && pDent.includes(CONFIG.oferta) && /Exemplo Advocacia/.test(pDent), 'serviço: prompt de antes (oferta e exemplo de serviço)');

console.log('Follow-up de loja');
const ant = [real];
const fu = 'Pense em quem procura ração à noite: com um catálogo simples, a pessoa vê o que a Bichoverde Agropecuária tem e chama no WhatsApp para perguntar o preço. Você quer que eu mande um exemplo de catálogo com WhatsApp?';
ok(lib.checarCorpoFollowup(fu, loja, 2, ant).length === 0, 'toque 2 de loja com produtos passa');
ok(/presume serviço/.test(lib.checarCorpoFollowup(fu.replace('um exemplo de catálogo com WhatsApp', 'um exemplo com agendamento online'), loja, 2, ant).join()), 'toque 2 de loja com agendamento reprova');
const fu3 = 'Esta é a minha última mensagem sobre o site da Bichoverde Agropecuária. Se não fizer sentido agora, sem problema, e fico à disposição se mudar de ideia.';
ok(lib.checarCorpoFollowup(fu3, loja, 3, ant).length === 0, 'toque 3 de loja não precisa citar produtos');
const it = { lead: loja, toque: 2, anteriores: ant };
const pFu = rodar('f_pedido_ia.js', { input: [{ json: {} }], nodes: { 'FU: loop': [{ json: it }] } })[0].json.messages[0].content;
ok(/Esta empresa é uma LOJA/.test(pFu) && pFu.includes(CONFIG.ofertaVarejo), 'prompt do follow-up de loja: produtos/catálogo/WhatsApp e oferta de loja');

console.log(`\nfalhas: ${falhas}`); process.exit(falhas ? 1 : 0);
