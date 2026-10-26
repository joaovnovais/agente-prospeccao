# Verificador de e-mail: Verifalia no lugar do Reacher (26/10/2026)

## Por quê
O Reacher consulta o SMTP a partir do IP da VPS, e o Gmail segura esse IP desde 08/10: o disjuntor abriu todo dia útil.
Ele também nunca concluía Hotmail/Outlook/Yahoo (50 de 50 `HeadlessError`).

A calibração local (39 e-mails, só o endereço, retenção de 5 min) deu:
- 16 de 17 `safe` do Reacher como `Deliverable` (94%);
- Hotmail/Outlook/Yahoo: 14 de 16 resolvidos (88%);
- Gmail inconclusivos no Reacher: 5 de 5 resolvidos;
- catch-all: 0.

O critério era ≥ 90% com ≥ 10 `safe`.

## O que mudou no workflow (`prspAgenteProsp1`)
Os dois nós HTTP do Reacher ("Reacher - variações do nome" e "Reacher - candidatos da IA") viraram três nós cada:

| Nó | O que faz |
|---|---|
| `Verifalia - <fase>` | `POST https://api.verifalia.com/v2.7/email-validations?waitTime=30000`, corpo `{ entries: [{ inputData }], quality: "Standard", retention: "0:5:0" }`. **Só o endereço** vai na chamada: sem nome, empresa ou cidade. |
| `Verifalia - aguardar (<fase>)` | `GET /email-validations/{id}?waitTime=30000`. Só vale quando o POST voltou `202` (ainda em andamento). O n8n não pula item num nó HTTP, então ele roda para todo item. Para job já concluído, ele só relê o resultado, sem gastar crédito. |
| `Verifalia → resultado (<fase>)` | `code/b_verifalia.js`: devolve o formato do Reacher (`{ input, is_reachable }`), que "Resultado verificação (código)" e "Escolher melhor e-mail" já usam. |

- **Credencial:** `httpBasicAuth` `prspVerifalia001` ("Verifalia - Prospeccao"), referenciada por ID. O segredo fica só no n8n.
- **Mapeamento:**
  - `Deliverable` → `safe`;
  - `Undeliverable` → `invalid`;
  - `Risky` e `Unknown` → `unknown`;
  - status `ServerIsCatchAll` → `unknown`.
  - Só `safe` é enviado, como antes.
- **Orçamento:** o mesmo da migration 007 (`prospeccao_reservar_reacher`, teto 25/dia = plano grátis da Verifalia), reservado antes de cada lote.
  - As origens agora são `verifalia:variacoes` e `verifalia:candidatos`.
  - O disjuntor continua registrado como `robson:disjuntor`, porque o watchdog em produção alerta por essa origem.
  - O contador no Supabase continua com o serviço `reacher` (nome histórico).
- **Disjuntor:** igual ao de antes, abre com 3 inconclusivos seguidos (`unknown`, erro HTTP, timeout, `202` que não concluiu).
- **HTTP 402:** os créditos do dia acabaram. O fluxo segue o mesmo caminho de "sem orçamento":
  - **variações:** "Verifalia sem créditos? (variações)" → "Sem orçamento Reacher". Encerra a verificação do dia e marca a execução para não rodar o fallback.
  - **candidatos:** "Verifalia sem créditos? (candidatos)" → "Parar: orçamento do Reacher".
  - Não há fallback para o Reacher. O excedente fica para o dia seguinte.
- **Ritmo:** uma consulta por vez, com 1 s entre elas (`verifaliaIntervaloMs`). O espaçamento de 6 s do Reacher saiu.
- **Hotmail/Outlook/Yahoo:** reativados. `emailPossivel` (`_lib.js`) não os recusa mais, nem nas variações nem nos candidatos da IA.
  - A geração de variações continua só em Gmail, para caber no teto de 25/dia.
- `config.json`: saíram `reacherUrl` e `reacherIntervaloMs`; entraram `verifaliaUrl`, `verifaliaIntervaloMs` e `verifaliaEsperaMs`.
  - `reacherLimiteDiario` e `reacherFalhasSeguidasMax` ficam com os nomes antigos, porque o watchdog os usa.
- O container do Reacher continua no ar (não é mais consultado pelo Robson).

## Testes
`workflow/tests/verificador-verifalia.test.mjs` usa respostas fictícias e não acessa a rede. Ele cobre:
- `Deliverable`, `Undeliverable`, `Risky`, `Unknown` e catch-all;
- `202` com espera, `202` que não conclui, `402` e erros;
- o disjuntor, o caminho do 402 e a credencial;
- o corpo só com o endereço.

As suítes antigas foram ajustadas onde descreviam o Reacher:
- nós e origem `robson:*` em `reacher-orcamento.test.mjs`;
- "hotmail recusado" em `auditoria-2026-10-05.test.mjs`.

## Cota compartilhada
Produção e scripts locais usam a mesma conta grátis (25 créditos/dia, zera às 21:00 BRT).
A partir do deploy, **nenhum uso local da Verifalia**: nem calibração, nem teste com a API real.
Se o teto for atingido em 3 dias úteis seguidos, o João compra o plano Starter.

## Rollback
1. `git revert <commit da troca>` em `main` (ou voltar ao commit anterior, `c069edc`) e `node workflow/build.mjs`.
2. `PACOTE=rollback-verificador bash workflow/deploy.sh robson`, fora da janela proibida e respeitando um deploy por dia. O script publica pela API e confere o build.
3. O container do Reacher não foi parado, então o fluxo antigo volta a funcionar sem nenhuma outra ação.
