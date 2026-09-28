// Passo 6: pedido de qualificação da resposta (1ª tentativa ou retry).
const j = $input.first().json;
if (j.messages) return [{ json: { tentativa: j.tentativa, messages: j.messages } }];

const ctx = $('Contexto da resposta').first().json;
const opcoes = ctx.envio.classificacao_ia?.opcoes_horario || [];
const system = `Você analisa respostas de empresas a um e-mail de prospecção da Novax (novax.ia.br). ${CONFIG.oferta}
Responda SOMENTE com um objeto JSON válido — sem markdown, sem texto antes ou depois — exatamente neste formato:
{"classificacao": "...", "escolheu_horario": null, "resumo": "...", "resposta_sugerida": "..."}

- "classificacao": um de "interessado" (quer conversar/aceita reunião), "quer_mais_info" (tem dúvidas, pede detalhes), "sem_interesse" (recusa educada ou não), "descadastro" (pede para não receber mais), "fora_do_escopo" (resposta automática, assunto sem relação, ou não dá para entender).
- "escolheu_horario": ${opcoes.length ? `número de 1 a ${opcoes.length} se a pessoa escolheu uma das opções de horário listadas; senão null` : 'sempre null'}.
- "resumo": até 200 caracteres descrevendo a resposta.
- "resposta_sugerida": se "interessado" ou "quer_mais_info", texto em português do Brasil de 2 a 5 frases, cordial, respondendo de forma geral às dúvidas (sem preços) e reforçando o convite para a reunião de diagnóstico gratuita. NÃO cite datas nem horários (são adicionados automaticamente). Sem assinatura, sem placeholders. Sem elogios sem base nos dados e sem promessas genéricas ("resultados reais", "sem equipe extra", "credibilidade", "aumentar vendas"). Nos outros casos, "".`;

const user = `E-mail que a Novax enviou (assunto: ${ctx.envio.assunto}):
"""${String(ctx.envio.corpo).slice(0, 1500)}"""
${opcoes.length ? '\nOpções de horário oferecidas:\n' + opcoes.map((o, i) => `${i + 1}) ${o.label}`).join('\n') + '\n' : ''}
Resposta recebida de ${ctx.lead.nome}:
"""${ctx.resposta.texto.slice(0, 2500)}"""`;

return [{ json: { tentativa: 1, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] } }];
