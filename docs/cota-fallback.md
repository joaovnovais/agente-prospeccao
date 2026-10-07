# Cota da IA no fallback — branch `robson2/cota-fallback` (deploy em 13/10 depois das 10:30, vale em 14/10)

Contexto (execução #507, 07/10 09:30):
- A cota de 45 chamadas esgotou no lead 27 de 30.
- 45 chamadas = 27 primeiras + 18 novas tentativas.
- Leads com e-mail confirmado: 6 chamadas para 4 envios. Fallback: 39 chamadas para 1 envio.
- O gargalo do Robson é a **oferta de e-mail confirmado** (~4 por dia), não a cota nem o limite de envio.

Esta branch parte de `robson2/fase1` (deploy de 08/10, build `5118433945de`) e só entra em produção em 13/10.

## O que muda
| Item | Arquivos | Efeito |
|---|---|---|
| (a) Fallback sem candidato não ganha nova tentativa | `b_validar_ia.js` | No fallback, se nenhum e-mail sugerido sobrevive aos filtros (variação já testada, provedor, homônimo), o lead vai direto para o descarte (`sem_email`), sem reprovar o texto. Em 07/10, 11 das 18 novas tentativas foram assim. Resposta que não é JSON continua indo para nova tentativa. |
| (b) Prompt alinhado ao validador | `b_pedido_ia.js` | Prompt proíbe explicitamente "bem avaliada", "boa avaliação", "reputação" e "nota alta", e traz 3 modelos de assunto. |
| (b) Assunto "Presença digital para" corrigido em código | `b_validar_ia.js`, `_lib.js` (`assuntoPadrao`) | Trocado por "{empresa} em {cidade}: perfil no Google sem site" (≤ 90 caracteres), sem nova chamada. As demais regras valem para o assunto novo. Saída `assunto_corrigido: true`. Foram 8 das 18 novas tentativas em 07/10. |
| (c) Teto diário do fallback | `config.json` (`maxChamadasFallbackDia: 15`), `b_pedido_ia.js`, `build.mjs` | Conta 1ª tentativa e novas tentativas do fallback por dia em BRT (static data do workflow). A 16ª vai para "Teto do fallback?" → "Parar: teto do fallback", que encerra o loop como a cota. E-mail confirmado (modo texto) nunca conta nem é barrado, e já vem antes na fila. |
| (c) Prioridade por avaliações | `build.mjs` ("Buscar fila fallback"), `b_montar_fila.js` | Fallback ordenado por `total_avaliacoes` desc (nulos no fim), depois `updated_at`. |
| Correção | `build.mjs` | "Buscar fila com e-mail" e "Buscar fila fallback" com `executeOnce`. A busca do fallback rodava uma vez por lead com e-mail (120 itens para 30 leads em 07/10). Era inofensivo pela deduplicação, mas multiplicava as consultas. |
| Taxa de e-mail confirmado por nicho | `supabase/006_confirmacao_nicho.sql`, `w_janela.js`, `w_resumo.js`, `build.mjs` (watchdog) | View `prospeccao_confirmacao_nicho` (captados → verificados → safe, % e últimos 7 dias). Às segundas, o resumo do watchdog ganha o bloco semanal. A consulta tem falha suave: sem a view, o resumo diário sai igual, com o aviso "indisponível". |

Testes:
- `workflow/tests/cota-fallback.test.mjs`: 43 testes, cobrindo (a), (b), (c), o bloco semanal, a estrutura e a migration só com view.
- As 4 suítes passam sem falhas. O teste antigo do watchdog agora espera 9 consultas.

## Simulação contra a #507 (replay, sem chamar IA nem Reacher)
O script `node workflow/tests/simular-execucao.mjs docs/local/execucao-507.json [--ordem-original]` aplica o código desta branch às 45 respostas reais da IA e aos resultados do Reacher gravados na #507. Os dados ficam em `docs/local/`.

| Cenário | Chamadas de IA | Envios |
|---|---|---|
| Original (07/10) | 45 (cota esgotada) | 5 |
| Esta branch (fallback por avaliações, teto 15) | **22** (fallback 15/15) | **3 confirmados + 1 provável** |
| Esta branch, mantendo a ordem original da fila | **22** (fallback 15/15) | **4 confirmados + 1 provável** |

O "provável" é o lead com 1 avaliação: com o validador de 08/10 (números por extenso), o texto gravado de 07/10 é reprovado. Ele precisa de 1 chamada a mais, que não há como reproduzir.

**Ressalva sobre a prioridade por avaliações:**
- O único envio do fallback em 07/10 veio de um lead com 3 avaliações. Com a prioridade por avaliações e o teto de 15, ele fica de fora.
- No histórico (90 leads verificados), a taxa de contato safe não muda com o número de avaliações: <10: 29%, 10–29: 24%, 30–99: 31%, 100+: 31%.
- A prioridade foi mantida como aprovada. Reavaliar com o bloco semanal. Para voltar à ordem antiga: em "Buscar fila fallback", trocar `order=total_avaliacoes.desc.nullslast,updated_at.asc,id.asc` por `order=updated_at.asc,id.asc` e remover o `sort` de `b_montar_fila.js`.

O efeito do prompt mais explícito (b) não entra no replay, porque reaproveita as respostas antigas. Ele só pode reduzir as novas tentativas.

## Ordem do deploy (13/10, depois das 10:30)
1. **Aplicar a migration 006** (só cria a view). Conferir com `select * from prospeccao_confirmacao_nicho;`.
2. `node workflow/build.mjs` → 4 suítes de teste → `lint.mjs` (Robson e watchdog) → anotar o build.
3. Merge em `main` → push → `bash workflow/deploy.sh robson` e `bash workflow/deploy.sh watchdog`.
4. Recarga pela UI dos **dois** workflows (Unpublish → Publish).
5. Itens críticos no export:
   - Robson: `Teto do fallback?`, `Parar: teto do fallback`, `maxChamadasFallbackDia`, `sem_candidato`, `assuntoPadrao`, `total_avaliacoes.desc.nullslast` e `executeOnce` nas duas buscas da fila;
   - watchdog: `W: confirmação por nicho` com `continueRegularOutput`.

## Aceite (14/10)
Pelo leitor, na execução das 09:30:
- chamadas de IA ≤ 45;
- itens de "Pedido IA - e-mail" em fallback ≤ 15;
- "Buscar fila fallback" com ≤ lote itens (não mais N × lote);
- envios dentro do limite (15 a partir de 14/10).

Segunda 19/10, 10:15: o e-mail do watchdog traz o bloco "Semana — e-mail confirmado por nicho".

## Rollback
`git revert` + build + `deploy.sh robson` / `deploy.sh watchdog` + recarga. A view 006 pode ficar: é aditiva e ninguém além do watchdog a lê. Só o teto: `maxChamadasFallbackDia` alto (ex.: 45) desliga o efeito sem mexer no fluxo.
