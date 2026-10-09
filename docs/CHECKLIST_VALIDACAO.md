# Checklist de validação — antes e depois de cada melhoria do Robson

Linha de base: tag `baseline-2026-10-06` (build `3c5576806d72`). Procedimento de deploy: `docs/DEPLOY.md`.
Último build no banco: `ce975f23e384` (06/10, ver `docs/correcoes-2026-10-06.md`). Ele só vale depois da recarga pela interface.

São dois workflows do Robson: `prspAgenteProsp1` (Robson) e `prspWatchdog01` (resumo diário às 10:15). O deploy é `bash workflow/deploy.sh robson|watchdog`, e cada um precisa da sua recarga.

## Janela segura (BRT)
- **Sem deploy nem recarga** de 08:30 a 10:00 em dias úteis (envio às 09:30) e às segundas de 06:30 a 07:30 (captação às 07:00).
- Nenhum cron do Robson nos próximos 20 min e nenhuma execução em andamento:
  - `execution_entity` sem `stoppedAt` no n8n;
  - ou a tela *Executions* sem "Running".

## Antes do deploy
- [ ] `node workflow/build.mjs` → anotar `build <id>`, nº de nós e nº de conexões.
- [ ] `node workflow/lint.mjs` e `node workflow/lint.mjs ./dist/novax-robson-watchdog.json` → `refs inexistentes: []`, `segredos no JSON? não`.
- [ ] `for t in workflow/tests/*.test.mjs; do node $t; done` → `falhas: 0` em todos (83 testes em 06/10).
- [ ] Exclusões de clientes: `config.json` guarda só **hashes**. Os originais ficam em `docs/local/exclusoes-originais.json`. Para incluir um cliente, gere o hash com `janelasHash` do `_lib.js` e confira com `docs/local/equivalencia-exclusoes.mjs`.
- [ ] Mudou regra de texto ou de filtro? Rode-a contra os envios reais anteriores (SELECT) e anote quantos passariam a ser rejeitados.
- [ ] `git diff --stat`:
  - só os arquivos esperados;
  - nenhum arquivo com centenas de linhas por troca de fim de linha. Os 13 arquivos CRLF continuam CRLF: `git ls-files --eol`.
- [ ] Diff do `dist`: ignorando UUIDs aleatórios (IDs de nó e `conditions[].id`), só mudam os nós esperados.
- [ ] Repositório público: nenhum nome, e-mail ou telefone de lead em arquivo versionado. Dados de terceiros só em `docs/local/`; confirme com `git check-ignore`.
- [ ] Migration nova, se houver:
  - **aditiva** (sem DROP, RENAME, mudança de tipo ou NOT NULL sem default);
  - RLS ligado e sem grant para `anon`/`authenticated`;
  - **aplicada antes do deploy**;
  - consultas antigas testadas depois de aplicar.
- [ ] Commit do `dist` final + `git push`; `main` = `origin/main`.

## Deploy
- [ ] Nenhum `/tmp/prsp_wf*` velho no host nem no container.
- [ ] `bash workflow/deploy.sh`:
  - sha256 local = host = container;
  - `Successfully imported`;
  - `banco = build <id> ✔`;
  - ativos: Robson + Claudia.
- [ ] Prova de conteúdo via `n8n export:workflow` (arquivo temporário com nome único, apagado depois):
  - build ID e nº de nós e conexões iguais ao `dist`;
  - itens críticos presentes. Hoje: `reacherFalhasSeguidasMax`, `$json.disjuntor === true` em "Reacher travou?", `order=updated_at.asc,id.asc`, `janelasHash`, `sobrenomesComuns`, `minAvaliacoesParaCitarNota` e `ASSUNTO_SITE_EXISTE_RE`;
  - watchdog: todos os nós HTTP com `executeOnce: true`. Sem isso, cada consulta roda uma vez por item e os números saem multiplicados, como aconteceu na 1ª prova de 06/10.
- [ ] **Recarga dos gatilhos:**
  - F5 no editor;
  - **Unpublish → Publish**. Pode exigir clique humano se o ambiente não tiver sessão nem API key;
  - nunca `docker restart`.
- [ ] Prova de ativação: `workflow_publish_history` do n8n com `deactivated` → `activated` na versão nova, **depois** do import (os logs em nível info não registram).
- [ ] Claudia: `list:workflow --active=true` lista `6NJ7fIsgaBsWh1iX`; container sem restart (`docker inspect … StartedAt`).

## Depois da 1ª execução (09:45 BRT)
- [ ] Execução das 09:30 no n8n:
  - `success`, 0 nós com erro;
  - `workflowVersionId` = versão nova;
  - nó "Resultado verificação (código)" com `disjuntor` e `falhasSeguidas` em todos os itens.
- [ ] Reacher (`docker logs --since 2h novax-prospeccao-reacher`):
  - consultas espaçadas (≥6 s no mesmo lead);
  - sem timeouts em sequência.
- [ ] Supabase (somente `SELECT`):
  - leads verificados hoje;
  - contatos por `reacher_status`;
  - envios do dia ≤ limite do ramp-up;
  - cota OpenRouter ≤ 45;
  - nenhum envio real repetido para o mesmo contato;
  - nenhum envio para contato `bloqueado`.
- [ ] **Ler à mão** os e-mails do dia (assunto + corpo):
  - nome, cidade e nota "N,N" corretos;
  - sem elogio ou promessa inventada;
  - acentuação certa;
  - rodapé SAIR presente.
- [ ] IMAP: há execução do fluxo de respostas desde a recarga, ou um e-mail de teste enviado para a caixa gerou execução.
  - O teste deve ser um e-mail **novo**, fora de thread, e terminar em "ignorar".
  - **Nunca** responda aos envios `teste=true`: eles apontam para contatos de leads reais. "SAIR" bloquearia o prospect, e "interesse" dispararia proposta, Calendar e Trello.

## Watchdog (10:15 BRT, dias úteis)
- [ ] Chegou o e-mail `[Robson] N e-mails hoje` ou `[ALERTA Robson] …` em `CONFIG.alertaDestino`.
- [ ] Os números batem com o Supabase:
  - envios reais ≤ limite do dia;
  - verificados;
  - `safe`;
  - chamadas à IA;
  - respostas;
  - fila sem verificação;
  - contatos pendentes.
- [ ] Se não chegou: a execução das 10:15 existe em `prspWatchdog01`? Se não existe, falta a recarga (Unpublish → Publish).

## Dados de produção
- Bloqueios manuais de contato usam `bloqueado_motivo` com data (ex.: `revisao_homonimo_06/10`). IDs e SQL de reversão ficam em `docs/local/`.

## Reacher (desde 09/10)
- Teto global de 25 consultas por dia, somando o Robson e qualquer script, teste ou amostra (migration 007).
- **Nenhuma consulta ao Reacher fora do Robson sem `reservarReacher()`** (`docs/local/reacher-orcamento.mjs`).
- Nada de rodadas avulsas no mesmo dia do envio só "para ver". Em 08/10, 19 consultas extras travaram o IP e o envio de 09/10 saiu zerado.

## Rollback
- Código: `git revert` do commit + build + `deploy.sh` + recarga.
- Dados: só por `UPDATE` reversível, com IDs e SQL de reversão registrados antes (nunca `DELETE`).
