# Validação do Robson — linha de base de 2026-10-06

Executada em 06/10, de 18:55 a 19:20 BRT, em modo **somente leitura**. Nenhum envio, nenhuma consulta nova ao Reacher, nenhum restart e nenhuma escrita em banco, VPS ou workflow.
Únicas escritas: a tag `baseline-2026-10-06` e este arquivo + `docs/CHECKLIST_VALIDACAO.md`.
O repositório é público: aqui só há contagens e localizações. Os detalhes com dados de terceiros ficaram no terminal da sessão.

## ⚠ Antes de tudo: dados de terceiros em arquivos versionados (repositório público)

| Local | O que é | Origem |
|---|---|---|
| `workflow/code/_lib.js:116` (e replicado 37× em `workflow/dist/novax-agente-prospeccao.json`) | Comentário com **nome de pessoa física** (lead) e o **e-mail** que a IA adivinhou para ela | Introduzido em 05/10 na auditoria (`953fbd1`) |
| `workflow/code/_lib.js` (comentário de `palavrasDistintivas`) | Nome de uma empresa-lead real usado como exemplo | Introduzido em 05/10 (`953fbd1`) |
| `workflow/config.json` → `exclusoes` (e replicado no dist) | Nomes dos **clientes reais da Novax**, um deles nome de pessoa física | Desde o commit inicial (é configuração funcional) |
| `workflow/config.json` → `modoTeste.redirecionarPara` | E-mail pessoal do João | Desde 27/09 (dado próprio) |

- **Sem envio indevido:** foram 5 envios hoje (limite 5) e cada prospect recebeu **1** e-mail real.
- **Envio de teste anterior:** os 5 e-mails que aparecem com mais de 1 envio tiveram 1 envio de **teste** em 28/09, redirecionado ao João, e 1 real hoje.
- **Telefones:** nenhum em arquivo versionado. As 2 ocorrências com formato de telefone são trechos de UUID.

## Resumo

1. **Produção = repositório:** o n8n roda o build `3c5576806d72` (versionId `3880292d…`), idêntico nó a nó ao `dist` de `main` (`af144e2`): 125 nós, 157 conexões, 37 Code nodes = `workflow/code/*` byte a byte.
2. **A recarga foi feita:** no `workflow_publish_history` do n8n há `deactivated` 18:33 UTC → `activated` 18:35 UTC de 05/10 (15:33–15:35 BRT) na versão `3880292d`, depois do import.
3. **A execução de 06/10 09:30 rodou o build novo (#501):**
   - `success`, 0 nós com erro, 09:30:00–09:38:20.
   - Campos `disjuntor` e `falhasSeguidas` presentes nos 15 leads; `falhasSeguidas` = 0 em todos e nenhum disjuntor aberto.
   - 17 consultas ao Reacher, espaçadas 6 s dentro do lead: 12 `invalid`, 5 `safe`, **0 `unknown`**.
   - 5 e-mails aceitos pelo SMTP.
4. **Números do Cowork conferem integralmente:** 15 verificados (09:30:10–09:33:23, advocacia SC), 9 contatos `safe` (4 de advocacia), 5 envios reais (09:33–09:37), OpenRouter 7, 0 respostas.
5. **8a, 8b e 8c aplicados:**
   - 8a: 12 leads `descartado / advocacia_fora_do_perfil`.
   - 8b: 14 leads "recuperado 05/10", de volta a `novo` com verificação zerada.
   - 8c: 5 leads "só envio de teste", enviados hoje.

## Fases

| Fase | Resultado | Evidência (BRT) |
|---|---|---|
| 1 Repositório | ⚠️ | 18:55 `main` = `origin/main` = `af144e2`, árvore limpa (só arquivos de instrução, ignorados ou não versionados). `seguranca/dashboard-login` 1 commit à frente (sem merge); `auditoria/2026-10-05` 0 à frente. **Repo público** (`gh api … private=false`, anônimo HTTP 200). Segredos: 0 valores (`sk-or-v1` só no regex do lint; `service_role`/`secret` só como nome de campo/placeholder). Dados de terceiros: ver topo. `revisao/`, `docs/local/` e os arquivos de instrução estão ignorados (`git check-ignore -v`). EOL no índice: 13 arquivos CRLF (`build.mjs`, `_lib.js`, `b_resultado_verificacao.js` e mais 10 de `code/`), 25 LF (inclui `config.json` e os demais `code/*.js`) — igual ao estado anterior aos commits de 05/10. |
| 2 Build, lint, testes | ✅ | Build `3c5576806d72`, 125 nós, 157 conexões; lint sem refs inexistentes e sem segredos; testes 36/36. Comparado ao `dist` commitado: mesmo build ID, nós e conexões; **0 nós diferentes** ignorando UUIDs aleatórios (IDs de nó e `conditions[].id` dos IFs). `config.json`: todos os 14 parâmetros conferem. |
| 3 Produção n8n | ✅ (IMAP: não verificado) | `novax-n8n` iniciado em 24/09 04:33 UTC, 0 restarts; Reacher desde 27/09; RAM disponível 1,8 GB, disco 27%, load 0, sem OOM. Ativos: Robson + Claudia. Export do n8n = repo (acima). Nenhum `/tmp/prsp_*` no host nem no container. Execução #501 detalhada no Resumo. Logs do n8n em nível info: 1 linha em 24 h ("Pruning old insights data"), portanto sem prova por log. A prova de ativação é o `workflow_publish_history`. IMAP: última execução em 05/10 10:54 (antes da recarga); 0 desde então, consistente com 0 respostas, mas o poll não está provado. Claudia: 0 execuções em 36 h (a última é de 01/10); sem falhas em 7 dias; container sem restart. |
| 4 Reacher | ✅ (DNS ⚠️) | Log de 24 h: 17 requisições `POST /v0/check_email` 200 entre 12:30:04 e 12:33:13 UTC, 115–690 ms, intervalo de 6 s dentro do lead e ≥10 s entre leads; 0 timeouts, 0 `HeadlessError`; 100% Gmail. Remetente: HELO `srv2004446.hstgr.cloud` (PTR ok), MAIL FROM `verificacao@novax.ia.br`; `novax.ia.br` continua **sem MX, SPF e DMARC** (DNS público 8.8.8.8). |
| 5 Supabase | ✅ | Ver "Números". Migrations 001–004 aplicadas; `tentativas_fallback smallint default 0 not null`; RLS ligado nas 4 tabelas; 0 grants para `anon`/`authenticated` (tabelas e funções); advisors iguais a 05/10 (7 INFO de RLS sem policy, intencional; 2 índices não usados). Integridade: 0 órfãos, 0 envio real duplicado por contato, 0 bloqueado com envio posterior, 0 `email_enviado` sem envio, 0 `place_id` duplicado, 0 status fora da lista. |
| 6 Qualidade dos e-mails | ⚠️ | Os 5 de hoje passam no validador (nome, cidade, nota "N,N", rodapé SAIR, sem imagem). Leitura crítica: 1 assunto enganoso ("… ganha site profissional"); 1 elogio sem base ("boa avaliação" no singular escapa da lista proibida); "nota 5,0 com 4 avaliações" é verdadeiro, mas fraco. Sintéticos "Gostariamos", "vincado", "clinica" e "nota de 4" são barrados; "boa avaliação" passa. Nome cadastrado sem acento é aceito como veio (coerente) e a mesma palavra fora do nome é barrada. |
| 7 Mapa | ✅ | Seção "Mapa para as melhorias". |
| 8 Riscos | ⚠️ | Seção "Riscos abertos". |

## Números (06/10, America/Sao_Paulo)

| Indicador | Valor |
|---|---|
| Leads verificados hoje | 15 (09:30:10–09:33:23), advocacia/SC criados em 05/10 |
| Contatos novos hoje | 9 `safe` Gmail `codigo_nome` (4 de advocacia; 5 são os contatos já existentes dos leads 8c, regravados no envio) |
| Envios hoje | 5 `prospeccao` `enviado` `teste=false` (09:33:39–09:37:18), todos dos leads 8c |
| Uso de API | OpenRouter 7/45 hoje (39 em outubro); Places 26/900 em outubro |
| Leads por status | novo 89 · sem_email 38 · email_enviado 18 · descartado 12 · revisao_manual 4 |
| Respostas / bloqueios | 0 / 0 (acumulado) |
| Fila para 07/10 | 4 contatos `safe` elegíveis (todos de advocacia); 74 leads `novo` sem verificação (60 advocacia + 14 recuperados 8b); 11 em fallback; `tentativas_fallback` = 0 nos 161 |
| Ramp-up 07/10 09:30 | semana 2 → **limite 10** (1º envio real 29/09 09:31:52) |

Guarda de e-mail nos 4 contatos de advocacia pendentes: 4/4 passam, 0 com só primeiro nome e 4/4 classificados como escritório. Em todos, porém, o nome tem **só 1 palavra distintiva**, e em 2 casos é um sobrenome muito comum. O risco é de homônimo, porque o Reacher prova que a caixa existe, não de quem ela é.

## Testes: cobertura e lacunas

- **Cobertos (36 asserts):** guarda de e-mail e provedores (8), classificador de advocacia (13), fallback inconclusivo (4), opt-out/SAIR (5), acentuação e nota (6).
- **Lacunas:** disjuntor (`b_resultado_verificacao.js`, testado só fora do repositório em 05/10), ramp-up/limite diário (`b_limite_dia.js`, `b_cabe_no_dia.js`), rotação de captação (`a_montar_buscas.js`), montagem da fila (`b_montar_fila.js`), extração e contexto de respostas IMAP (`c_extrair_resposta.js`, `c_contexto.js`), e "boa avaliação" (singular).

## Mapa para as melhorias

| Seção | Gatilho / nós principais | Arquivos `workflow/code/` | Lê | Escreve |
|---|---|---|---|---|
| Captação | `Semanal - Captação` (seg 07:00) → Montar buscas → Reservar cota Places → Places Text Search → Filtrar → Upsert leads | `a_montar_buscas`, `a_filtrar_places`, `a_resumo` | `prospeccao_taxa_resposta` | `prospeccao_leads`, `prospeccao_uso_api` (via RPC) |
| Verificação (fase 1) | `Diário - Envio` (seg–sex 09:30) → Buscar leads p/ verificação → Loop → Variações do nome → Reacher → Resultado → Reacher travou? → Salvar contato / Marcar verificação | `b_limite_dia`, `b_variacoes`, `b_resultado_verificacao`, `b_resumo_verificacao` | `prospeccao_status_envio`, `prospeccao_leads` | `prospeccao_contatos`, `prospeccao_leads` |
| Envio (fase 2) | Buscar fila com e-mail + fallback → Montar fila → Loop leads → Pedido IA → OpenRouter → Validar → (fallback: candidatos → Reacher → Escolher) → E-mail definido → Checar bloqueio LGPD → Montar e-mail → SMTP → Saída (B) → Registrar envio → Atualizar lead → Trello → Espaçar envios | `b_montar_fila`, `b_cabe_no_dia`, `b_pedido_ia`, `b_validar_ia`, `_retry`, `b_separar_candidatos`, `b_escolher_email`, `b_email_definido`, `b_montar_email`, `b_resultado_envio`, `b_descarte`, `b_revisao`, `_saida`, `_lib` | `prospeccao_leads`, `prospeccao_contatos`, `prospeccao_status_envio` | `prospeccao_envios`, `prospeccao_leads`, `prospeccao_contatos`, `prospeccao_uso_api`; Trello |
| Respostas | `Gmail IMAP - respostas` → Loop → Extrair → Buscar envio original → Contexto → (descadastro \| qualificação IA → agendar/propor/revisão/perdido) → Saída (C) | `c_extrair_resposta`, `c_contexto`, `c_pedido_ia`, `c_validar_ia`, `c_decidir`, `c_horarios`, `c_slot_livre`, `c_evento_body`, `c_confirmacao`, `c_resultado_resposta`, `c_bloqueio`, `c_revisao` | `prospeccao_envios` (+ lead/contato) | `prospeccao_envios`, `prospeccao_leads`, `prospeccao_contatos`; Calendar; Trello |
| Revisão manual | IA inválida após `maxTentativasIA`, cota esgotada (respostas), fora do escopo, falha de Calendar | `b_revisao`, `c_revisao` | — | `prospeccao_leads` (`revisao_manual`), Trello "Revisão manual" |
| Descadastro | Regex `OPTOUT_RE` em `c_contexto` + classificação IA `descadastro`/`sem_interesse` | `c_contexto`, `c_bloqueio` | — | `prospeccao_contatos.bloqueado`; checado em "Checar bloqueio LGPD" antes de todo envio |

**Parâmetros (`workflow/config.json`) e efeito:**
- **Volume diário de envio:** `rampUpEnviosPorDia`, contado desde o 1º envio real.
- **Captação:**
  - `cidadesPorSemana` (26) define o tamanho da janela de cidades; acima do tamanho da lista do estado, há repetição.
  - `limitePlacesPorExecucao` (80) e `limiteMensalPlaces` (900) limitam as chamadas ao Places.
  - `rotacao`, `inicioRotacao` e `nichos` definem o nicho de cada semana e o texto do segmento no prompt.
- **Verificação:**
  - `verificacaoPorExecucao` (15) é o teto da fase 1.
  - `reacherFalhasSeguidasMax` (3) é a sensibilidade do disjuntor.
  - `reacherIntervaloMs` (6000) e `pausaEntreVerificacoesSeg` (10) controlam o ritmo do Reacher; reduzir arrisca tarpit.
  - `maxCandidatosEmail` (6) é o teto de candidatos de e-mail por lead.
- **IA:**
  - `limiteDiarioOpenRouter` (45) é a cota diária.
  - `maxTentativasIA` (3) é o número de retries.
  - `maxTentativasFallback` (2) é quantas vezes um fallback inconclusivo volta à fila.
- **Ritmo do SMTP:** `esperaEntreEnviosSeg` ([30,60]).
- **Conteúdo:** `remetente`, `oferta` e `exclusoes`. `exclusoes` contém dados de clientes; ver topo.
- **Agendamento:** `agenda` (horários, duração, dias à frente).
- **Testes:** `modoTeste.*` (redireciona, limita, dry-run e força malformação).

**Pontos de extensão:**

| Melhoria | Onde plugar | O que pode quebrar | Migration | Risco |
|---|---|---|---|---|
| Follow-up D+3/D+7 | Novo ramo no `Diário - Envio` depois da fase 2 (ou gatilho próprio): selecionar `prospeccao_envios` tipo `prospeccao` sem resposta há N dias, contato não bloqueado → IA (modo texto) → SMTP com `assunto` "Re:" | Ramp-up/limite diário: hoje conta só `tipo='prospeccao'`; o follow-up precisa entrar no limite e na cota de IA. Casamento de respostas: o novo envio precisa salvar `message_id` | Sim: `tipo` aceitar `followup` (check constraint) e, idealmente, coluna `seq`/`followup_de` | Médio (volume e reputação; checar SAIR antes) |
| Painel de métricas / alerta "0 envios em dia útil" | Gatilho cron separado (ex.: 10:15 seg–sex) lendo `prospeccao_status_envio` e enviando aviso (e-mail para o João ou Telegram) | Nada no fluxo atual | Não (view já existe) | Baixo |
| Novas fontes de contato | Entre "Variações do nome" e "Reacher": novos candidatos (ex.: OSM `contact:email`, Instagram/bio) com a mesma guarda `emailIdentificaEmpresa` | Tarpit do Reacher (mais consultas), LGPD (origem do dado) | Sim: novo valor em `prospeccao_contatos.origem` (check constraint) | Médio |
| Segundo canal (SMS/ligação) | Leads `sem_email` com `telefone` → fila separada | Isolamento da Claudia (não usar o número dela); consentimento | Sim: tabela/colunas de canal e status | Alto (regulatório e custo) |
| Demo por lead | Depois de "E-mail definido", antes do SMTP: gerar página/demo e incluir link | Validador hoje proíbe links no corpo (regra de conteúdo); tempo da execução | Talvez (URL da demo por lead) | Médio |

**Restrições de plataforma:**
- `import:workflow` desativa o workflow no banco.
- `publish:workflow`/CLI não recarrega o processo; só **Unpublish → Publish** no editor recarrega, sem `docker restart`, que derruba a Claudia.
- O nó de e-mail do n8n não envia `List-Unsubscribe`.
- O Reacher só conclui Gmail (Hotmail/Outlook/Yahoo = `HeadlessError`).
- Os logs do n8n em nível info não registram ativação: use `workflow_publish_history`.

## Riscos abertos (estado em 06/10)

| Risco | Estado |
|---|---|
| Repositório público com dados de terceiros | **Aberto.** Continua público. Na árvore atual há o comentário com pessoa física em `_lib.js` e os nomes de clientes em `config.json` (ver topo). No histórico estão os 61 e-mails de `revisao/` e os nomes de advogados dos commits de 05/10. |
| Dashboard com `service_role` sem login | **Aberto.** A branch `seguranca/dashboard-login` (1 commit) não teve merge; o estado do app no Streamlit Cloud não foi verificado. |
| DNS do MAIL FROM do Reacher | **Aberto.** Sem MX/SPF/DMARC. Hoje não houve `unknown` com espaçamento de 6 s: o risco é menor do que se supunha, mas continua. |
| Captação repetindo buscas idênticas | **Aberto.** Não há paginação nem rotação de termos (backlog). |
| Leads só com telefone | **Aberto.** Nenhum canal; 38 `sem_email`. |
| Follow-up | **Inexistente.** Nenhum nó ou código de cadência no workflow. |
| Alerta de 0 envios | **Inexistente.** |
| IMAP sem prova de poll desde a recarga | **Não verificado.** |
| Homônimos em endereços de 1 palavra distintiva | **Aberto.** 4/4 dos pendentes de advocacia. |
