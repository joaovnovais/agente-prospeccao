# Robson 2.0 — Fase 1 (gancho aditivo no `prspAgenteProsp1`)

Branch `robson2/fase1`. É a única fase do 2.0 que altera o workflow atual. Alvo de deploy: 08/10 depois das 10:30; limite: 09/10 depois das 10:30. Precisa estar em produção antes da captação de 12/10 às 07:00.

## O que muda
| Item | Arquivos | Efeito |
|---|---|---|
| Migration `005_robson2_base.sql` | `supabase/` | Cria a tabela `prospeccao_respostas`. A regra de `tipo` aceita também `followup`, `resposta` e `lembrete`. Em `prospeccao_envios`: `toque`, `envio_pai_id`, `origem_modulo` e `nicho`. Em `prospeccao_leads`: `etapa_funil`, `retomar_em`, `tipo_google` e `tipos_google`. A view `prospeccao_status_envio` ganha `followup_hoje`, `respostas_hoje` e `total_todos_hoje`; as 3 colunas antigas mantêm o mesmo cálculo. |
| Resposta bruta | `build.mjs` (ramo C), `c_extrair_resposta.js`, `c_bloqueio.js`, `c_revisao.js`, `c_resultado_resposta.js` | A resposta casada com um envio é gravada em `prospeccao_respostas` antes de qualquer ação (3 tentativas, nunca bloqueia o fluxo). No fim, "Registrar ação v1" grava o `acao_v1` final: `optout`, `sem_interesse`, `proposta_horarios`, `agendado`, `revisao_manual`, `erro_envio` ou `v2_registrado`. |
| Flag `respostas.motor` | `config.json`, `build.mjs` | Com `v1` (padrão), tudo funciona como antes. Com `v2`, o v1 só grava; o SAIR continua imediato. Só muda na Fase 3. |
| Limite compartilhado | `_lib.js` (`enviadosReaisHoje`), `b_limite_dia.js`, `b_cabe_no_dia.js` | Respostas a leads nunca são barradas e já contam no limite. O envio frio e o follow-up usam o que sobrar (`total_todos_hoje`). Sem a migration, vale a conta antiga. |
| Todo segmento | `config.json` (`catalogoNichos`, `rotacao`), `a_montar_buscas.js`, `a_filtrar_places.js`, `b_pedido_ia.js`, `_lib.js` | Catálogo de 21 nichos com 1 ou 2 termos. Por semana, 4 nichos × 15 cidades de GO+SC, sem repetir nicho×cidade dentro do ciclo. Máximo de 60 buscas por execução e teto mensal de 300 (de 900). Captura `primaryType`/`types` do Places. O prompt usa o tipo do Google, e não o rótulo interno do nicho. `checarFatos` barra ramo sem base. Filtro de perfil em todo nicho: pessoa física/autônomo (fora da saúde), entidade de classe, órgão público e instituição religiosa. Termos de ramo e de razão social entram nas palavras genéricas da guarda de e-mail. `nicho` é gravado no envio. |
| Calendar indisponível | `c_horarios.js`, `c_revisao.js`, `build.mjs` ("Calendar ok? (proposta)") | Antes, um freeBusy com erro (ex.: token expirado, como de ~05/10 a 07/10) gerava um e-mail ao lead perguntando "qual o melhor dia", sem horários. O lead ia para `respondeu`, sem alerta, e entrava num ciclo se respondesse com um horário. Agora vai para revisão manual no Trello, com a resposta completa, e nenhum e-mail sai. A checagem do horário escolhido cai no mesmo caminho. |
| Módulos 2.0 | `config.json` (`modulos.*.estagio`) | Todos `desligado`. O build recusa valor inválido. |

## Impacto medido nos dados reais (06/10, só contagens)
- Guarda de e-mail: recusaria 1 dos 18 envios reais já feitos (nome composto só de termos genéricos). Os 2 contatos pendentes continuam elegíveis.
- Regra de ramo: 0 dos 18 textos reais passariam a ser rejeitados. Leads antigos, sem tipo do Google, usam o nicho da busca como evidência.
- Filtro de perfil: consultórios de saúde com nome de profissional ("Dra. …") continuam aceitos.
- Places em outubro: 26 usadas + 3 × 60 = 206 de 300.

## Ordem do deploy
1. **Migration 005 primeiro.** Sem ela, a captação (colunas `tipo_google`/`tipos_google`) e o registro de envio (`nicho`) falham. Conferir com: `select column_name from information_schema.columns where table_name in ('prospeccao_envios','prospeccao_leads')` e `select * from prospeccao_status_envio`.
2. `node workflow/build.mjs` → 3 suítes de teste → `lint.mjs` (Robson e watchdog).
3. Merge em `main` → push → `bash workflow/deploy.sh robson`.
4. Recarga pela UI (Unpublish → Publish), fora de 08:30–10:30 nos dias úteis.
5. Itens críticos no export: `Gravar resposta bruta` com `retryOnFail`, `Motor v1?` com `true === true`, `Registrar ação v1`, `total_todos_hoje`, `catalogoNichos`, `primaryTypeDisplayName` e `p_limite: 300`.

## Aceite
- Dia útil seguinte: envio das 09:30 normal (`success`, volume esperado).
- Resposta recebida aparece em `prospeccao_respostas` com `acao_v1` igual ao que o fluxo fez. O teste é um e-mail do João respondendo a um envio `teste=true`, sem SAIR nem interesse.
- Segunda 12/10, 07:00: 4 nichos, ≤ 60 buscas, `tipo_google` preenchido nos leads novos.

## Rollback
`git revert` + build + `deploy.sh robson` + recarga. A migration fica, porque é aditiva e não muda nada antigo. Se a gravação quebrar o IMAP, remova só os nós "Gravar resposta bruta", "Motor v1?", "Motor v2: só registra" e "Registrar ação v1".
