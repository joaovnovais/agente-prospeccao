# Paginação do Places e rotação do termo — branch `robson2/places-paginacao` (sobre `robson2/cota-fallback`)

Alvo: entrar no deploy de 13/10 junto com `cota-fallback`. Build em 07/10: **`77b2411d6d1c`**. Nada foi deployado.

## Achado
Nas 38 buscas reais (27/09 e 05/10), **todas** vieram cheias (20 resultados), mas **nenhuma** trouxe `nextPageToken`. O motivo é que o field mask não pedia `nextPageToken`, e o Places (New) só devolve o token quando o field mask pede.

## O que muda
| Item | Arquivos | Efeito |
|---|---|---|
| `nextPageToken` no field mask | `build.mjs` | Sem isso não há paginação. |
| Ondas de página | `build.mjs`, `a_proxima_pagina.js` (novo) | Onda 1 = página 1 de cada busca, como hoje. Ondas 2 e 3 pedem a próxima página só de quem tem token e trouxe ≥ `minSemSiteParaProximaPagina` (3) PMEs sem site operando na página atual, das mais produtivas para as menos. Cada página reserva 1 chamada na cota mensal (RPC, teto 300). O total da execução, somando as páginas, fica em `limitePlacesPorExecucao` (60). Máximo de 3 páginas (60 resultados) por busca. |
| Filtro genérico por onda | `a_filtrar_places.js` | Lê o contexto do nó da onda (`ORIGEM_BUSCA`) e devolve `buscas` (sem site por página + token), que decide a página seguinte. |
| Resumo somado | `a_resumo.js` | Soma as ondas e mantém os campos antigos (`leads_novos`, `sem_site_encontrados`, `excluidos_lista_manual`, `erros_places`), mais `chamadas_places` e `por_pagina`. Os upserts sempre devolvem item, para o fluxo seguir mesmo quando todo lead já existe. |
| Rotação do termo | `a_montar_buscas.js` | Antes, o termo só mudava a cada ciclo. Agora a ocorrência usa `termos[(fatia + ciclo + termoInicial) % nTermos]`: **quando o nicho volta, usa o próximo termo**, e no ciclo seguinte cada fatia de cidades recebe termo diferente do anterior. Em ~2 ciclos (63 semanas), nenhum nicho de 2 termos repete cidade + termo (testado). Nicho de 1 termo repete a busca: aí quem traz novidade são as páginas 2-3. `termoInicial` (opcional, por nicho) desloca o 1º termo de um nicho já buscado. |
| Largura | `config.json` | `rotacao.cidadesPorNicho` 15 → **10**: 40 buscas de página 1 por semana, e até 20 chamadas ficam para as páginas 2-3. Novo bloco `paginacao: { paginasMax: 3, minSemSiteParaProximaPagina: 3 }`. |

Testes:
- `workflow/tests/places-paginacao.test.mjs`: 32 testes (config, rotação, filtro, próxima página/orçamento, resumo e estrutura).
- As 5 suítes passam sem falhas.

## Simulação da cota por mês
O script `node workflow/tests/simular-cota-places.mjs [FATOR] [RODADAS]` roda o planejador e o nó "Próxima página" reais em cada segunda de 12/10 a dezembro. As PMEs sem site por página são sorteadas da distribuição real das 38 buscas (média 4,3 por página).

Pior caso para a cota: toda busca tem página seguinte.

| Mês (segundas) | Chamadas: atual (15 cidades, pág. 1) | Chamadas: branch (10 cidades, até 3 pág.) | Sem site, atual | Sem site, branch (pág. 2-3 = pág. 1) | Sem site, branch (pág. 2-3 = metade) |
|---|---|---|---|---|---|
| Out/2026 (3, + 26 já usadas) | 206 / 300 | 206 / 300 | ~768 | ~768 | ~640 |
| Nov/2026 (5) | **300 / 300** | **300 / 300** | ~1.280 | ~1.280 | ~1.065 |
| Dez/2026 (4) | 240 / 300 | 240 / 300 | ~1.023 | ~1.023 | ~852 |

Leitura:
- **O custo de cota é idêntico.** Cada execução usa exatamente 60 nos dois casos e nunca passa disso.
- **Novembro bate o teto de 300 com ou sem paginação**, por ter 5 segundas. Uma execução manual extra nesse mês seria recusada pelo RPC, sem erro, com "Cota Places esgotada".
- **Em volume bruto, a paginação não ganha.** Empata se as páginas 2-3 forem tão ricas em PMEs sem site quanto a 1, e perde ~17% se renderem metade. Não há dado real das páginas 2-3, porque o token nunca foi pedido.
- **O ganho real é nas buscas repetidas**, em que a página 1 só traz duplicados (a simulação conta resultados, não novidade):
  - `advocacia` tem 1 termo, já foi buscada em 26 cidades e volta em 09/11;
  - `odontologia_estetica` já foi buscada em 12 cidades;
  - todo nicho de 1 termo a partir do 2º ciclo.

## Decisão para 13/10 (João)
- **Como está na branch:** 10 cidades + até 3 páginas. A captação de 19/10 é a primeira com páginas 2-3. O resumo `por_pagina` mede o rendimento real das páginas 2-3 em PMEs sem site e em leads novos.
- **Alternativa sem mudar o comportamento atual:** `cidadesPorNicho: 15` e `paginasMax: 1`. O código entra desligado, e a paginação é ligada perto de 09/11, quando voltam os nichos já buscados. A rotação do termo vale nos dois casos.
- **Efeito na checagem semanal:** com 10 cidades, a captação passa a ter 40 buscas de página 1 e até 60 chamadas no total. Os critérios da C5 para semanas futuras (60 buscas, 15 cidades por nicho) mudam para: ≤ 40 buscas de página 1, ≤ 10 cidades por nicho e `chamadas_places` ≤ 60.
- **Sobreposição de cidades na transição:** os 4 nichos da semana 0 (12/10, fatias de 15 cidades) voltam com fatias de 10. A 2ª ocorrência deles repete 5 cidades da 1ª:
  - nos nichos de 2 termos, com termo diferente;
  - em `material_construcao` (1 termo), a busca repete, e as páginas 2-3 cobrem.

## Deploy (13/10, junto com `cota-fallback`)
- Esta branch contém `cota-fallback`. Fazer o merge **desta** em `main` leva as duas.
- Ordem:
  1. migration 006;
  2. build e 5 suítes de teste;
  3. lint;
  4. merge;
  5. push;
  6. `deploy.sh robson` + `deploy.sh watchdog`;
  7. Publish dos dois.
- Itens críticos no export:
  - `nextPageToken` no field mask das 3 ondas;
  - nós `Próxima página (p2)` e `(p3)`;
  - `paginacao`;
  - `cidadesPorNicho`.
- Rollback só da paginação: `paginasMax: 1` (e, se quiser, `cidadesPorNicho: 15`) + build + deploy + Publish.
