# Deploy do Robson (workflow `prspAgenteProsp1`)

Procedimento verificado desde 2026-10-05. Motivo: em 05/10 um deploy manual reimportou um `/tmp/prsp_wf.json` de 02/10 que tinha ficado na VPS, e o conserto do disjuntor (`f9b43bd`) nunca entrou no ar.

## Regras
- Nunca fazer deploy à mão (`docker cp /tmp/prsp_wf.json …`). Usar só `workflow/deploy.sh`.
- Nunca reiniciar o container `novax-n8n`: ele atende o webhook da Claudia (`6NJ7fIsgaBsWh1iX`).
- Não importar com menos de 20 min para um cron do Robson (seg 07:00 captação; seg–sex 09:30 envio) nem com execução em andamento.

## Passo a passo
1. Migrações novas em `supabase/` primeiro (sempre aditivas).
2. `node workflow/build.mjs` → anote o `build <id>` impresso.
3. `node workflow/lint.mjs` e `node workflow/tests/auditoria-2026-10-05.test.mjs` (0 falhas).
4. Commit do `workflow/dist/novax-agente-prospeccao.json` + `git push`.
5. `& "C:\Program Files\Git\bin\bash.exe" workflow/deploy.sh` (Windows) ou `bash workflow/deploy.sh`. O script:
   - copia o dist para `/tmp/prsp_wf_<sha12>.json` (nome único) e confere o sha256 no host e no container;
   - `import:workflow` → `publish:workflow`;
   - `export:workflow` e confere que o banco contém `build: <id>` — se imprimir `✘ … NÃO é o build`, pare;
   - apaga os temporários e lista os workflows ativos.
6. **Recarga (obrigatória):** a CLI só grava no banco; o processo do n8n continua com a versão anterior.
   Abra `https://hooks.novax.ia.br/workflow/prspAgenteProsp1`, **F5**, **Unpublish → Publish**. Não clique em "Execute workflow".
7. Conferência: na próxima execução, os Code nodes trazem o comentário `build: <id>` e o nó "Resultado verificação (código)" tem os campos `disjuntor` e `falhasSeguidas`.

## Disjuntor da verificação (fase 1)
- Lead com resultado inconclusivo do Reacher (`unknown`, timeout, erro HTTP) é pulado: não é marcado como verificado e vai para o fim da fila (`order=updated_at.asc,id.asc`).
- A fase 1 só para depois de `reacherFalhasSeguidasMax` (3) inconclusivos seguidos na mesma execução.
- As consultas ao Reacher saem uma por vez, com `reacherIntervaloMs` (6 s) entre elas: rajadas fazem o Gmail segurar o IP da VPS (141 timeouts em 258 consultas até 05/10).
- No fallback, se todos os candidatos derem `unknown`/erro, o lead volta para `novo` (até `maxTentativasFallback` = 2, coluna `tentativas_fallback`).
