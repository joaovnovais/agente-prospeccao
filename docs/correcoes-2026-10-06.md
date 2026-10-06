# Correções do Robson — 2026-10-06

Execução autônoma em 06/10, de 19:14 a ~19:45 BRT, dentro da janela de deploy (até 22:00).
O repositório é público: aqui só há contagens, hashes e IDs de workflow. Os dados de terceiros (nomes, e-mails, IDs de contato) ficam em `docs/local/` (gitignored) e no terminal da sessão.

## Resumo

| Fase | Horário (BRT) | Resultado |
|---|---|---|
| 1. Preflight | 19:14 | `main` = `origin/main` = `a1e6887`. Robson ativo no build `3c5576806d72`, Claudia ativa, nenhuma execução em andamento, nenhum cron até 10:15 de 07/10. |
| 2. Privacidade | 19:14–19:18 | Comentários com dados reais trocados por exemplos genéricos. As exclusões de clientes viraram **hashes**, com equivalência provada. O plano de limpeza do histórico está em `docs/local/limpar-historico.md`. |
| 3. Homônimo | 19:18–19:19 | Nova regra no código. **3 contatos `safe` bloqueados em produção**, com reversão registrada. |
| 4. Validador de texto | 19:19–19:21 | Elogio no singular, assunto enganoso e nota com poucas avaliações. |
| 5. Testes | 19:21–19:25 | Disjuntor, ramp-up, homônimo, exclusão por hash, validador e watchdog. **83 testes, 0 falhas.** |
| 6. Watchdog | 19:25–19:31 | Novo workflow `prspWatchdog01`, deployado e com prova executada (2ª prova correta). |
| 7. Deploy do Robson | 19:26–19:29 | Build `ce975f23e384` está no banco do n8n. **A recarga pela interface está pendente (João).** |
| 8. IMAP | 19:33 | Analisado só pelo código, sem nenhum disparo. O teste seguro está em `docs/local/teste-imap.md`. |
| 9. Docs | 19:33–19:45 | Este arquivo, `CHECKLIST_VALIDACAO.md` e a nota do Obsidian. |

Commits:
- `f8a7226`: correções + build `88fe8ea107a8`.
- `dceb626`: `executeOnce` no watchdog + build `ce975f23e384`.
- Commit de docs (este arquivo).

Os builds de teste não foram commitados.

## Fase 2 — privacidade

### Exclusões de clientes
`config.json → exclusoes` guarda agora o FNV-1a 64 de janelas de 1 a 4 palavras normalizadas (`janelasHash`, `exclusoesJanelaMax: 4`): 7 regras.

Os nomes originais ficam só em `docs/local/exclusoes-originais.json`. A equivalência foi provada por `docs/local/equivalencia-exclusoes.mjs` contra os 161 leads do banco:
- **0 divergências** entre a regra antiga (texto) e a nova (hash);
- 8/8 positivos sintéticos excluídos;
- 0/4 negativos excluídos;
- 1/161 leads reais excluído, o mesmo nas duas versões.

### Histórico
Os commits antigos e as branches `auditoria/2026-10-05` e `seguranca/dashboard-login` ainda contêm os dados. A limpeza exige reescrever o histórico e fazer force-push, o que é **decisão do João**. O plano está em `docs/local/limpar-historico.md`. Antes, deixar o repositório privado e checar o acesso do app do Streamlit ao repositório.

## Fase 3 — homônimo
`emailIdentificaEmpresa` passa a recusar o caso em que o e-mail está em provedor gratuito (gmail, hotmail, outlook, yahoo, bol, uol…) **e** a única palavra do nome da empresa achada no e-mail é um sobrenome comum. A lista `CONFIG.sobrenomesComuns` tem 141 entradas. A guarda vale na geração e também é reaplicada em `b_montar_fila.js` aos contatos já salvos.

A regra sugerida, "exigir ≥7 letras", foi **descartada**: recusaria 7 dos 18 envios reais legítimos.

**Ação em produção (19:19 BRT, única escrita de dados):**
- 3 contatos `safe` ainda não enviados foram bloqueados com `bloqueado_motivo='revisao_homonimo_06/10'`:
  - 1 de nome genérico, com o lead já em `revisao_manual`;
  - 2 de sobrenome comum.
- Os IDs e o SQL de reversão estão em `docs/local/bloqueio-homonimo-2026-10-06.md`.
- Continuam elegíveis 2 contatos `safe`.

## Fase 4 — validador de texto
- `FRASES_PROIBIDAS`: `boa(s) avaliação/nota/reputação`, `bem avaliad…`, `reputação`, `nota alta`.
- `ASSUNTO_SITE_EXISTE_RE`: o assunto não pode sugerir que a empresa já tem site ("ganha site", "novo site", "site pronto", "já tem site"…; "não tem site" e "sem site" continuam permitidos).
- `minAvaliacoesParaCitarNota: 10`:
  - abaixo disso, o prompt manda não citar nota e o `checarFatos` rejeita qualquer nota citada;
  - a regex de nota passou a pegar também "nota 5," (`(?!\d|,\d)`).

Impacto nos 18 envios reais já feitos:
- **3 passariam a ser rejeitados**: assunto "ganha site", "nota 5,0" com 4 avaliações e "boa avaliação";
- 1 já rejeitado ganha mais um motivo;
- 0 falsos positivos da regex de assunto.

## Fase 5 — testes e regra do ramp-up
O ramp-up conta o tempo **exato** desde o 1º envio real, em 29/09 às 09:31:52 BRT: `semana = floor((agora − primeiro) / 7 dias)`.

| Execução | Situação | Limite |
|---|---|---|
| 06/10 às 09:30 | Ainda na semana 1 (faltavam 2 min) | 5 |
| 07/10 a 13/10 | Semana 2. Em 13/10 às 09:30 ainda faltam 2 min para a semana 3. | 10 |
| A partir de 14/10 | Semana 3 | 15 |

Testes em `workflow/tests/correcoes-2026-10-06.test.mjs` (nomes fictícios):
- disjuntor do Reacher (abre no N-ésimo `unknown`/erro seguido e zera no sucesso);
- fronteiras do ramp-up;
- homônimo;
- exclusão por hash;
- validador;
- cenários de alerta do watchdog;
- teste estrutural: todo nó HTTP do watchdog tem `executeOnce`.

## Fase 6 — watchdog `prspWatchdog01`
- **Agendamento:** cron `15 10 * * 1-5`, ou seja, 10:15 BRT em dias úteis.
- **Consultas:** só GET no Supabase, em 8 consultas: status, envios, verificados, contatos, uso de API, respostas, fila sem verificação e contatos pendentes.
- **Saída:** 1 e-mail para `CONFIG.alertaDestino` pelo SMTP da prospecção. O assunto é `[ALERTA Robson] …` quando há 0 e-mails, 0 verificados, erro de envio ou cota de IA esgotada; caso contrário, `[Robson] N e-mails hoje`.
- **Isolamento:** não toca no Robson nem na Claudia.

### Provas (execução manual pela CLI, só o watchdog)
- **1ª prova (19:28):** números **errados**. Os nós HTTP rodavam uma vez por item de entrada e multiplicavam os resultados (75 verificados, 675 `safe`). Esse e-mail chegou ao João e deve ser **desconsiderado**.
  - Correção: `executeOnce: true` em todos os nós HTTP, mais o teste estrutural (`dceb626`).
- **2ª prova (19:31), correta:**
  - 5 envios reais, limite 5;
  - 15 verificados, 9 `safe`;
  - IA 7, 0 respostas;
  - 74 leads sem verificação, 2 contatos pendentes.

  Bate com a validação de 06/10.

## Fase 7 — deploy

| Workflow | Build | Deploy (BRT) | sha256 do dist | Situação |
|---|---|---|---|---|
| Robson `prspAgenteProsp1` | `ce975f23e384` | 19:29:47 | `cce3cad9…74e340` | O deploy anterior das 19:26 era `88fe8ea107a8`. |
| Watchdog `prspWatchdog01` | `ce975f23e384` | 19:30:15 | `3ad61a3b…cac586` | Credenciais "Supabase - Prospeccao" e "Gmail SMTP - Prospeccao". |

Em ambos os deploys:
- sha256 local = host = container;
- `Successfully imported`;
- publicado no banco;
- o export confirma build, nº de nós (125 e 13) e todos os itens críticos;
- 0 arquivos temporários restantes.

Claudia ativa, container sem restart.

**Recarga pendente.** A sessão do n8n no navegador expirou (tela de login) e não há API key. Por isso o processo em execução **continua com o build validado `3c5576806d72`** (versionId `3880292d…`) e **não conhece o watchdog**. Os dois só passam a valer depois do Unpublish → Publish na interface, feito pelo João. Fora da janela de 08:30–10:00.

Se a recarga não for feita antes de 07/10 às 09:30, o Robson roda o build antigo:
- limite 10 (semana 2);
- os 3 contatos de risco estão bloqueados **por dado**, e o código antigo já respeita `bloqueado`;
- os 2 contatos elegíveis restantes podem ser enviados;
- serão verificados até 15 leads novos, mas sem a guarda de homônimo nem o validador novo. Revisar os envios do dia à mão.

O watchdog não dispara às 10:15 sem a recarga.

## Fase 8 — IMAP (análise do código, sem disparo)
- `c_extrair_resposta.js` ignora e-mails sem `In-Reply-To`/`References` e os enviados pela própria caixa.
- `c_contexto` procura o `message_id` em `prospeccao_envios`. Se não acha, o e-mail está fora de thread e o resultado é "ignorar".
- Efeitos de uma resposta reconhecida:
  - "SAIR" → bloqueia o contato e marca o lead `perdido` (+ Trello);
  - interesse → proposta de horários por e-mail (Calendar) + Trello "Respondeu";
  - outros textos → classificação pela IA, podendo ir para `revisao_manual` com card.
- **Risco:** os envios `teste=true` de 27–28/09 apontam para contatos de **leads reais**. Responder a eles alteraria leads reais.
- **Teste seguro:** um e-mail novo, fora de thread, para a caixa da prospecção. Prova o polling (execução terminando em "ignorar") sem mudar nenhum dado.
- Ainda não houve execução do gatilho IMAP desde a recarga de 05/10. O teste depende do João.

## Pendências (João)
1. Recarregar `prspAgenteProsp1` e `prspWatchdog01`: F5 → menu ao lado de *Published* → Unpublish → confirmar → Publish. **Nunca** "Execute workflow".
2. Teste do IMAP (`docs/local/teste-imap.md`).
3. Deixar o repositório privado (checar o Streamlit antes) e decidir sobre a limpeza do histórico.
4. Merge de `seguranca/dashboard-login` depois de definir a senha do painel.
