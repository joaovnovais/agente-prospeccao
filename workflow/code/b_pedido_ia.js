// Passo 3: monta o pedido à IA. Modo "texto": e-mail já confirmado na fase 1 → só assunto/corpo.
// Modo "fallback": nenhuma variação do nome passou → IA sugere e-mails alternativos + texto.
// Recebe tanto a 1ª tentativa (de "Cabe no limite?") quanto retries (de "Preparar retry - e-mail").
const j = $input.first().json;
// 13/10 (c): teto diário de chamadas do fallback (CONFIG.maxChamadasFallbackDia), contando 1ª tentativa e novas tentativas.
// O modo "texto" (e-mail já confirmado) não conta nem é barrado. Contador no static data do workflow, por dia em BRT
// (persiste entre execuções de produção do mesmo dia). Estourou → "Teto do fallback?" encerra o loop (como a cota da IA).
if (j.lead.fila?.modo !== 'texto') {
  const sd = $getWorkflowStaticData('global');
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.agenda.fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!sd.fallbackDia || sd.fallbackDia.dia !== dia) sd.fallbackDia = { dia, chamadas: 0 };
  if (sd.fallbackDia.chamadas >= CONFIG.maxChamadasFallbackDia) return [{ json: { lead: j.lead, teto_fallback: true, chamadas_fallback: sd.fallbackDia.chamadas } }];
  sd.fallbackDia.chamadas++;
}
if (j.messages) return [{ json: { lead: j.lead, tentativa: j.tentativa, messages: j.messages } }];

const lead = j.lead;
const fallback = lead.fila?.modo !== 'texto';
const tentadas = variantesEmail(lead.nome, lead.cidade).filter(emailPossivel);
const formato = fallback ? '{"candidatos_email": ["..."], "assunto": "...", "corpo": "..."}' : '{"assunto": "...", "corpo": "..."}';
const regrasEmail = !fallback ? '' : `
Regras para "candidatos_email" (2 a 5 itens):
- Endereços prováveis da própria empresa, SOMENTE no domínio gmail.com (outros provedores não podem ser verificados).
- Use pelo menos duas palavras do nome da empresa; nunca só um primeiro nome de pessoa.
- Estes já foram testados e NÃO existem, não repita: ${tentadas.join(', ') || 'nenhum'}.
- Tente abreviações e formas curtas do nome (usuário do Gmail tem no máximo 30 caracteres), sem acentos, espaços ou pontuação.
- Somente letras minúsculas. Nunca invente nomes de pessoas.
`;
// Copy v2 (12/10): e-mail de uma pessoa para outra. O formato do assunto é sorteado pelo código (formatoAssunto) e o
// prompt já recebe o texto pronto quando o nome cabe (até 4 palavras); o validador (checarAssuntoV2/checarCorpoV2) repete as regras.
const pessoa = CONFIG.remetente.nomePessoa;
const L = CONFIG.corpoLimites;
// 21/10: a forma curta do nome vem pronta do código para todo lead (nomeCurtoAssunto) — a IA não escolhe mais.
const nomeTxt = nomeCurtoAssunto(lead);
const assuntoPronto = montarAssunto(formatoAssunto(lead), lead, nomeTxt);
const plural = nomeSugerePlural(lead.nome);
const pergunta = plural ? `Faz sentido eu explicar a vocês, em poucas linhas, como isso funcionaria para ${nomeTxt}?`
  : `Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para ${nomeTxt}?`;
const citaNota = lead.rating != null && lead.total_avaliacoes != null && lead.total_avaliacoes >= CONFIG.minAvaliacoesParaCitarNota;
const regraNota = citaNota
  ? `cite uma única vez, logo depois do nome, exatamente "(nota ${fmtNota(lead.rating)}, ${lead.total_avaliacoes} avaliações)"`
  : 'NÃO cite nota, estrelas nem número de avaliações, nem por extenso ("uma avaliação", "cinco estrelas")';
const system = `Você escreve, em nome de ${pessoa}, da Novax (novax.ia.br), o primeiro e-mail para uma pequena empresa. ${CONFIG.oferta}
Responda SOMENTE com um objeto JSON válido — sem markdown, sem texto antes ou depois — exatamente neste formato:
${formato}
${regrasEmail}
"assunto": copie EXATAMENTE este texto, letra por letra, sem acrescentar, tirar ou trocar nada (nem maiúsculas, nem pontuação): "${assuntoPronto}".
- Ao citar a empresa no corpo, use a forma "${nomeTxt}".

"corpo": e-mail curto de uma pessoa para outra, em português do Brasil, nesta ordem:
1. Comece exatamente com "Olá! Sou o ${pessoa}, da Novax."
2. Uma observação neutra: você pesquisou o ramo da empresa em ${lead.cidade} no Google e o perfil de ${nomeTxt} apareceu sem site; ${regraNota}.
3. Uma frase concreta com o que um site simples resolve para esse ramo (ex.: mostrar serviços ou áreas de atuação, endereço e horário, botão de WhatsApp, agendamento), sem prometer resultado.
4. Termine com esta pergunta: "${pergunta}"
- ${L.palavrasMin} a ${L.palavrasMax} palavras, 3 a 5 frases curtas, no máximo 2 parágrafos.
- ${plural ? 'Trate por "vocês" (o nome indica mais de uma pessoa).' : 'Trate a pessoa por "você" ou "te" (singular). Nunca "vocês".'} Nada de formas com gênero ("convidá-lo", "convidá-la", "convidá-los", "Prezado(a)").
- Descreva o ramo apenas pelo nome da empresa e pelo tipo informado pelo Google Maps. Não afirme ramo nem especialidade que não esteja nesses dados (ex.: não chame uma clínica de estética de "odontológica" nem de "dental").
- Acentuação correta em TODAS as palavras (ex.: "clínica", "não", "avaliações", "horário", "você") — nunca "clinica", "nao", "avaliacoes".
- Use SOMENTE os dados fornecidos (nome, tipo, cidade, nota, número de avaliações, ausência de site). Números sempre em algarismos, copiados dos dados.
- NÃO elogie nem qualifique a empresa (proibido: "ótimo", "excelente", "referência", "bem avaliada", "boa avaliação", "boas avaliações", "muitas avaliações", "reputação", "nota alta").
- NÃO use promessas genéricas (proibido: "sem precisar de equipe extra", "resultados reais", "mais credibilidade", "aumentar vendas", "garantia").
- NÃO use: "Olá, vi que", "Olá, equipe", "lacuna", "dificulta", "resolveria", "reunião", "30 minutos", "gratuita", "Gostaria de", "presença digital", "site profissional". Diga "site simples" ou só "site".
- Sem preços, sem emojis, sem links, sem colchetes nem chaves, sem saudação final, assinatura ou rodapé (são adicionados automaticamente).

Exemplo do tom (empresa fictícia, não copie os dados):
{"assunto": "Uma ideia para Exemplo Advocacia", "corpo": "Olá! Sou o ${pessoa}, da Novax. Pesquisei escritórios de advocacia em Cidade Exemplo no Google e o perfil do Exemplo Advocacia (nota 4,4, 29 avaliações) apareceu sem site, então quem quer ver áreas de atuação ou agendar uma consulta não tem para onde ir.\\n\\nA Novax cria sites simples para escritórios, com agendamento e resposta automática pelo WhatsApp. Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para o Exemplo Advocacia?"}`;

const user = `Empresa: ${lead.nome}
Tipo no Google Maps: ${lead.tipo_google || 'não informado (use só o nome da empresa)'}
Cidade: ${lead.cidade}/${lead.estado}
Endereço: ${lead.endereco || 'não informado'}
Avaliação no Google: ${lead.rating != null ? fmtNota(lead.rating) : 'sem nota'} (${lead.total_avaliacoes ?? 0} avaliações)
Site: nenhum cadastrado no Google Maps`;

return [{ json: { lead, tentativa: 1, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] } }];
