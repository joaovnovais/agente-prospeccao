# Checklist de validação — antes e depois de cada melhoria do Robson

Linha de base: tag `baseline-2026-10-06` (build `3c5576806d72`). Procedimento de deploy: `docs/DEPLOY.md`.

## Janela segura (BRT)
- **Sem deploy nem recarga** de 08:30 a 10:00 em dias úteis (envio às 09:30) e às segundas de 06:30 a 07:30 (captação às 07:00).
- Nenhum cron do Robson nos próximos 20 min e nenhuma execução em andamento:
  - `execution_entity` sem `stoppedAt` no n8n;
  - ou a tela *Executions* sem "Running".

## Antes do deploy
- [ ] `node workflow/build.mjs` → anotar `build <id>`, nº de nós e nº de conexões.
- [ ] `node workflow/lint.mjs` → `refs inexistentes: []`, `segredos no JSON? não`.
- [ ] `node workflow/tests/auditoria-2026-10-05.test.mjs` (e qualquer teste novo) → `falhas: 0`.
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
  - itens críticos presentes. Hoje: `reacherFalhasSeguidasMax`, `$json.disjuntor === true` em "Reacher travou?" e `order=updated_at.asc,id.asc`.
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

## Rollback
- Código: `git revert` do commit + build + `deploy.sh` + recarga.
- Dados: só por `UPDATE` reversível, com IDs e SQL de reversão registrados antes (nunca `DELETE`).
