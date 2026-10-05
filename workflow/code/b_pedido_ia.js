// Passo 3: monta o pedido à IA. Modo "texto": e-mail já confirmado na fase 1 → só assunto/corpo.
// Modo "fallback": nenhuma variação do nome passou → IA sugere e-mails alternativos + texto.
// Recebe tanto a 1ª tentativa (de "Cabe no limite?") quanto retries (de "Preparar retry - e-mail").
const j = $input.first().json;
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
const system = `Você é redator de prospecção B2B da Novax (novax.ia.br). ${CONFIG.oferta}
Responda SOMENTE com um objeto JSON válido — sem markdown, sem texto antes ou depois — exatamente neste formato:
${formato}
${regrasEmail}
Regras para "assunto": curto (4 a 9 palavras), sem emojis, sem CAIXA ALTA, sem ponto de exclamação.
- Deve conter um dado específico desta empresa: a cidade, o nome da empresa, a nota ou o número de avaliações.
- Se citar a nota, use SEMPRE vírgula e uma casa decimal, copiando exatamente o valor informado abaixo (ex.: "nota 3,4"). NUNCA arredonde, trunque ou escreva "nota 3" nem "nota 3.4" (ponto).
- Não comece com "Presença digital para". Varie a construção.

Regras para "corpo" (português do Brasil):
- 4 a 6 frases (um e-mail curto), tom cordial, direto e humano. Não conte palavras nem caracteres: escreva naturalmente.
- Cite o nome da empresa e a cidade.
- Descreva o ramo da empresa apenas pelo que o nome dela indica. Não afirme especialidade que não esteja no nome (ex.: não chame uma clínica de estética de "odontológica" nem de "dental").
- Escreva em português correto, com acentuação em TODAS as palavras que precisam (ex.: "clínica", "não", "avaliações", "reunião", "horário") — nunca "clinica", "nao", "avaliacoes".
- Use SOMENTE fatos dos dados fornecidos (nome, segmento, cidade, nota, número de avaliações, ausência de site). Se citar nota ou avaliações, use exatamente os números fornecidos.
- NÃO elogie nem qualifique a empresa sem base nos dados (proibido: "ótimo atendimento", "excelente", "referência", "boas avaliações", "muitas avaliações", etc.).
- NÃO use promessas genéricas (proibido: "sem precisar de equipe extra", "resultados reais", "mais credibilidade", "aumentar vendas", "garantia"). Descreva concretamente o que um site resolveria para quem pesquisa esta empresa no Google.
- Mencione concretamente a lacuna encontrada: a empresa não tem site vinculado ao perfil do Google, então quem pesquisa no Google não encontra informações completas nem um canal para agendar/comprar.
- Convide para uma reunião de diagnóstico gratuita de 30 minutos, online.
- Sem preços, sem promessas exageradas, sem emojis, sem links, sem placeholders entre colchetes ou chaves.
- NÃO inclua saudação final, assinatura nem rodapé (são adicionados automaticamente).`;

const user = `Empresa: ${lead.nome}
Segmento pesquisado: ${(CONFIG.nichos || {})[lead.nicho] || lead.nicho} (a especialidade exata desta empresa só é conhecida pelo nome dela)
Cidade: ${lead.cidade}/${lead.estado}
Endereço: ${lead.endereco || 'não informado'}
Avaliação no Google: ${lead.rating != null ? fmtNota(lead.rating) : 'sem nota'} (${lead.total_avaliacoes ?? 0} avaliações)
Site: nenhum cadastrado no Google Maps`;

return [{ json: { lead, tentativa: 1, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] } }];
