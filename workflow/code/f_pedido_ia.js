// Texto do toque 2/3 (mesma IA do envio frio). Retry: chega com messages já prontas (de "FU: preparar retry").
const j = $input.first().json;
const it = $('FU: loop').first().json;
if (j.messages) return [{ json: { tentativa: j.tentativa, messages: j.messages } }];
const lead = it.lead;
const pessoa = CONFIG.remetente.nomePessoa;
const F = CONFIG.followup;
const plural = nomeSugerePlural(lead.nome);
const nomeTxt = nomeCurtoAssunto(lead);
const citaNota = lead.rating != null && lead.total_avaliacoes != null && lead.total_avaliacoes >= CONFIG.minAvaliacoesParaCitarNota;
// 05/11: loja/varejo pelo tipo do Google → produtos, catálogo e WhatsApp; nada de serviços nem agendamento.
const varejo = ehVarejo(lead);
// 06/11 (João, sombra de 06/11): o toque 2 repetia o 1º e-mail ("Notei que o perfil … aparece sem site … sim ou não?").
// Agora: ângulo novo (um exemplo concreto do dia a dia daquele tipo de negócio), abertura variada por lead,
// nota só como "nota X com N avaliações", e pergunta aberta (nunca "sim ou não").
const exemplo = toque2Exemplo(lead, varejo);
const abertura = toque2Abertura(lead);
const angulo = it.toque === 2
  ? `Toque 2 (o primeiro e-mail não teve resposta). O primeiro e-mail já disse que o perfil no Google aparece sem site: NÃO repita isso (nada de "sem site", "perfil no Google", "notei", "vi que").
Traga um ângulo NOVO: um benefício concreto para este tipo de negócio, contado como uma situação do dia a dia. Ideia para adaptar ao tipo "${lead.tipo_google || 'não informado'}": ${exemplo}
Abertura: ${abertura}`
    + (citaNota ? `\nSe citar a avaliação, escreva exatamente "nota ${fmtNota(lead.rating)} com ${lead.total_avaliacoes} avaliações" (não é obrigatório).` : '\nNÃO cite nota nem avaliações.')
    + '\nTermine com UMA pergunta curta e aberta, oferecendo mandar um exemplo ou explicar como funcionaria. Nunca escreva "sim ou não".'
  : 'Toque 3 (último contato): encerramento educado e curto. Deixe claro que é a última mensagem e que, se não fizer sentido agora, sem problema. Não peça nada novo. Nunca escreva "sim ou não".';
const system = `Você escreve, em nome de ${pessoa}, da Novax (novax.ia.br), uma resposta curta na MESMA conversa de e-mail com uma pequena empresa que ainda não respondeu. ${varejo ? CONFIG.ofertaVarejo : CONFIG.oferta}
${varejo ? 'Esta empresa é uma LOJA: fale de produtos, catálogo e WhatsApp para dúvidas e pedidos. NÃO fale de serviços, agendamento, consultas, reservas nem "atendimento" (diga "resposta automática").\n' : ''}
Responda SOMENTE com um objeto JSON válido — sem markdown, sem texto antes ou depois — exatamente neste formato:
{"corpo": "..."}

${angulo}

Regras para "corpo" (português do Brasil):
- 2 a 4 frases curtas, ${F.palavrasMin} a ${F.palavrasMax} palavras, um parágrafo.
- Não se apresente de novo (nada de "Sou o ${pessoa}") e não repita frases do e-mail anterior: escreva com outras palavras e outro ângulo.
- ${plural ? 'Trate por "vocês".' : 'Trate a pessoa por "você" ou "te" (singular). Nunca "vocês".'} Nada de formas com gênero ("convidá-lo", "Prezado(a)").
- Use SOMENTE os dados fornecidos. Não afirme ramo nem especialidade fora do nome e do tipo do Google. Acentuação correta em todas as palavras.
- Proibido: urgência falsa ("última chance", "vagas limitadas", "só hoje", "promoção", "desconto"), elogios ("ótimo", "excelente", "referência", "bem avaliada", "reputação"), promessas ("aumentar vendas", "resultados reais", "garantia"), "reunião", "minutos", "gratuita", "Gostaria de", "presença digital", "site profissional", preços, emojis, links, colchetes ou chaves.
- Sem saudação final, assinatura ou rodapé (são adicionados automaticamente).`;
const anteriores = it.anteriores.map((a) => String(a).split('\n\n' + CONFIG.remetente.assinatura)[0]).join('\n---\n').slice(0, 2500);
const user = `Empresa: ${lead.nome} (cite como "${nomeTxt}")
Tipo no Google Maps: ${lead.tipo_google || 'não informado (use só o nome da empresa)'}
Cidade: ${lead.cidade}/${lead.estado}
Avaliação no Google: ${lead.rating != null ? fmtNota(lead.rating) : 'sem nota'} (${lead.total_avaliacoes ?? 0} avaliações)
Site: nenhum cadastrado no Google Maps

E-mail(s) anterior(es) desta conversa (não repita frases):
"""${anteriores}"""`;
return [{ json: { tentativa: 1, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] } }];
