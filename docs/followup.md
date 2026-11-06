# Fase 2 — Follow-up (`prspFollowUp001`)

O follow-up manda o 2º e o 3º toque na mesma conversa do e-mail inicial, pela API do Gmail (raw RFC 2822), sem gastar Verifalia. Ele é um workflow separado do Robson: 09:00 BRT em dias úteis, antes do envio frio das 09:30. Plano aprovado pelo João em 03/11/2026.

## Regras (aprovadas em 03/11)
| Regra | Valor (`config.json → followup`) |
|---|---|
| Toque 2 | a partir de D+3 dias úteis após o toque 1 (`diasToque2`), **só se o toque 1 foi há no máximo 15 dias úteis** (`maxDiasToque2`). Os mais antigos ficam sem follow-up. |
| Toque 3 | toque 1 há ≥ 7 dias úteis (`diasToque3`) **e** toque 2 há ≥ 4 dias úteis (`minDiasEntreToques`). Máximo de 3 toques. |
| Dias úteis | seg–sex, fora de `feriados` (nacionais: 02/11, 15/11, 20/11, 25/12…). Feriado: o módulo não roda e o dia não conta. |
| Elegível | envio inicial real (`teste=false`, `status=enviado`, com `message_id`); lead em `email_enviado`; sem resposta (nem em `prospeccao_respostas`, nem `resposta_recebida_em`); contato sem bloqueio nem `bloqueado_motivo`; `retomar_em` vazio ou vencido. Toques de teste não avançam a cadência real. |
| Ordem | **intercalada** (decisão do João em 03/11): um toque 2, um toque 3, alternando, começando pelo toque 2; o que sobrar de um tipo vai no fim. Dentro de cada tipo, quem está mais perto de sair da janela primeiro (mais dias úteis desde o toque 1). |
| Teto por dia | sombra: todos os elegíveis são registrados e só os 8 primeiros (`sombraMaxTextos`) ganham texto. Teste: **3/dia** (`tetoTeste`). 1ª semana ligado (5 dias úteis desde `ligadoDesde`): **6/dia** (`tetoSemana1`, ajuste do João em 03/11). Depois: **50% do limite diário** (`fracaoLimite`). Sempre ≤ espaço que sobra no limite do dia, que é compartilhado com o envio frio (`total_todos_hoje`). |
| Horário | para limpo às **09:25** (`pararAs`) e manda o resumo. |
| Texto | mesma IA e mesma cota do envio frio. 2–4 frases, 20–70 palavras. Toque 2 (ajuste do João em 06/11): **ângulo novo**, um exemplo do dia a dia daquele tipo de negócio (loja: produto, catálogo e WhatsApp; oficina: modelo do carro pelo WhatsApp; etc.), sem repetir "perfil no Google sem site"; abertura variada por lead (4 estilos), nunca "Notei que"/"Vi que"/"O perfil"; nota só como "nota X com N avaliações"; termina com pergunta aberta, nunca "sim ou não". Toque 3: encerramento educado ("se não fizer sentido agora, sem problema"). Proibido: repetir 6 palavras seguidas do e-mail anterior, urgência falsa, apresentar-se de novo, elogio, promessa, link, nota/avaliações erradas (`checarFatos`). Mesmo rodapé LGPD (SAIR). 3 tentativas; se reprovar, vira card de revisão no Trello (fora da sombra) e não envia. |
| Conversa | assunto `Re: <assunto original>`; `In-Reply-To` = `Message-ID` do toque anterior; `References` = todos os `Message-ID` da conversa; `Message-ID` novo no formato `<uuid@gmail.com>`, gravado em `prospeccao_envios.message_id`. Sem threadId e sem ler a caixa. |
| Envio | credencial **Gmail API - Prospeccao** (`FkmazYel2pQxKksn`, só `gmail.send`). Grava `prospeccao_envios` com `tipo='followup'`, `toque`, `envio_pai_id`, `origem_modulo='followup'`, `nicho`. Bloqueio LGPD conferido de novo na hora do envio. |
| Resposta do lead | o IMAP do Robson já casa pelo `References`; quem responde sai da cadência. |

## Estágios (`config.json → modulos.followup.estagio`)
- `sombra`: calcula, gera o texto e grava em `prospeccao_followup_sombra`; **não envia nada**. O resumo do dia (com até 5 textos) vai para o João às ~09:10.
- `teste`: envia de verdade pela Gmail API, mas **para o João** (`followup.redirecionarPara`), com o prefixo `[TESTE 2.0 → followup]` e `teste=true`.
- `ligado`: envia para o lead. Exige `followup.ligadoDesde` (o build e o teste recusam sem ela).
- `desligado`: sai no primeiro nó.

## Calendário (aprovado em 03/11; remarcado em 05/11 porque o deploy de 04/11 foi barrado)
| Dia | O quê | Deploy do dia |
|---|---|---|
| 05/11 | `PACOTE=followup-sombra bash workflow/deploy.sh followup` (feito às 10:30, versão `16d960f7`) | follow-up (sombra) |
| 06/11 | 1ª sombra às 09:00 (texto antigo); checagem às 10:55; às 11:15, **texto para lojas** em pacote único: `PACOTE=texto-varejo` para `robson` **e** `followup` | Robson + follow-up (mesmo pacote) |
| 09/11 | 2ª sombra (já com a regra de lojas) + checagem às 10:55; `PACOTE=watchdog-retry bash workflow/deploy.sh watchdog` | watchdog |
| 10/11 | 3ª sombra + checagem às 10:55 → **AÇÃO DO JOÃO: aprovar os textos**. Às 15:00, se aprovado: estágio `teste` | follow-up (teste) |
| 11/11 | teste às 09:00 (até 3 envios para o João) + checagem | — |
| 12/11 | teste às 09:00 + checagem às 10:55 → **AÇÃO DO JOÃO: confirmar thread e remetente**. Às 15:00, se confirmado: estágio `ligado`, `ligadoDesde` = 2026-11-13 | follow-up (ligado) |
| 13/11 | 1º dia ligado (6/dia de 13 a 19/11; 20/11 é feriado; 50% do limite a partir de 23/11) | — |

**Aprovação do João:** ele responde na sessão ou escreve no topo da nota de estado a linha exata:
- 10/11: `✅ TEXTOS FOLLOW-UP APROVADOS (10/11)`
- 12/11: `✅ THREAD E REMETENTE CONFIRMADOS (12/11)`

Sem a linha, a tarefa das 15:00 só registra e não muda de estágio.

**Simulação (dados de 03/11):** dos 86 envios reais, 54 estariam elegíveis ao toque 2 em 05/11 e 48 em 12/11; 38 ficam de fora pela janela de 15 dias úteis.

**Simulação dia a dia, de 12/11 a 30/11** (86 envios reais + hipótese de 7 envios frios novos por dia útil; limite 20):

| Teto 1ª semana | Ordem | Toques 2 | Toques 3 | Perdem a janela |
|---|---|---|---|---|
| **6/dia** | **intercalada (em uso desde 03/11)** | **62** | **38** | **6** |
| 6/dia | toque 2 primeiro (antes) | 100 | 0 | 0 |
| 6/dia | toque 3 primeiro | 64 | 36 | 12 |
| 3/dia | intercalada | 56 | 29 | 15 |

Na ordem antiga (toque 2 primeiro), o toque 3 nunca chegava a vez: entram ~7 toques 2 por dia. Em 12/11 ainda não há toque 3 elegível (nenhum toque 2 foi enviado antes), então os 6 do dia são toques 2. Os primeiros toques 3 aparecem a partir de 18/11 (toque 2 + 4 dias úteis).

## Mudança de estágio (procedimento)
1. No repositório principal, em `main`, edite `workflow/config.json`: `modulos.followup.estagio` (e, para `ligado`, `followup.ligadoDesde`).
2. Rode `node workflow/build.mjs`, todos os testes (`falhas: 0`) e o lint dos 3 `dist`.
3. Faça o commit e rode `node docs/local/varrer-dados.mjs origin/main main`; depois o push.
4. `PACOTE=followup-<estágio> bash workflow/deploy.sh followup`. Precisa sair "publicado pela API ✔".
5. Confira no export a versão ativa: o build e o estágio embutido no CONFIG dos Code nodes (`"followup":{"estagio":"<estágio>"}`).
6. **Rollback:** estágio `desligado` → build → deploy. Nenhum dado é apagado.

## Checagem diária do follow-up (somente leitura)
- **Execução:** leitor de execuções com `--workflow prspFollowUp001 --desde '<dia> 11:30:00'`. Esperado `success`, terminando antes das 09:25, com o build esperado (última linha `prspFollowUp001` do `deploys.log`).
- **Sombra:** `select toque, count(*), count(corpo) com_texto, count(erro) com_erro from prospeccao_followup_sombra where dia='<dia>' group by 1;`. Nenhuma linha em `prospeccao_envios` com `origem_modulo='followup'` nesse dia.
- **Teste:** envios do dia com `origem_modulo='followup'`, todos `teste=true`, no máximo 3; nenhum para lead.
- **Ligado:** envios `followup` reais ≤ teto do dia; 0 para contato bloqueado; 0 para lead que respondeu; o envio frio das 09:30 normal.
- **Resultado:** OK / ATENÇÃO / FALHA, com o mesmo critério do arquivo de regras. FALHA: execução com erro, envio fora do estágio (sombra que enviou, teste que foi para lead), envio a bloqueado ou a quem respondeu.
