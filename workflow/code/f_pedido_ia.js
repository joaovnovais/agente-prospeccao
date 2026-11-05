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
const angulo = it.toque === 2
  ? `Toque 2 (o primeiro e-mail não teve resposta): lembre o fato verificável — o perfil de ${nomeTxt} no Google aparece sem site`
    + (citaNota ? ` (se quiser, cite "nota ${fmtNota(lead.rating)}, ${lead.total_avaliacoes} avaliações", exatamente assim)` : ' (NÃO cite nota nem avaliações)')
    + ' — e termine com UMA pergunta direta de sim ou não.'
  : 'Toque 3 (último contato): encerramento educado e curto. Deixe claro que é a última mensagem e que, se não fizer sentido agora, sem problema. Não peça nada novo.';
// 05/11: loja/varejo pelo tipo do Google → produtos, catálogo e WhatsApp; nada de serviços nem agendamento.
const varejo = ehVarejo(lead);
const system = `Você escreve, em nome de ${pessoa}, da Novax (novax.ia.br), uma resposta curta na MESMA conversa de e-mail com uma pequena empresa que ainda não respondeu. ${varejo ? CONFIG.ofertaVarejo : CONFIG.oferta}
${varejo ? 'Esta empresa é uma LOJA: fale de produtos, catálogo e WhatsApp para dúvidas e pedidos. NÃO fale de serviços, agendamento, consultas nem reservas.\n' : ''}
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
