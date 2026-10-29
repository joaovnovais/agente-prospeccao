# Copy v2 do primeiro e-mail — branch `robson2/copy-v2` (sobre `robson2/places-paginacao`)

Escrita em 12/10/2026. Nada foi deployado. Build: **`9f4719001b6b`** (reproduzível: 2 builds seguidos, mesmo ID). O build de `places-paginacao` (`127ddc65d6a0`) não muda.

## Por quê
Revisão do João em 12/10. Nos 29 envios reais (29/09 a 12/10):
- 0 respostas;
- 17 abrem com "Olá, vi que" ou "Olá, equipe";
- 29 pedem "reunião gratuita de 30 minutos";
- 16 têm nota ou número de avaliações no assunto;
- 28 usam "lacuna", "dificulta", "resolveria" ou "profissional";
- todos assinam "Equipe Novax".

Com esse volume, 0 respostas não prova que o texto falha, mas o molde é o mesmo em todos os envios.

## O que muda
| Item | Arquivos | Efeito |
|---|---|---|
| Remetente em pessoa | `config.json` (`remetente.nomePessoa`, `remetente.assinatura`) | Assinatura "João Novais / Novax · novax.ia.br \| instagram.com/novax.ia.br" no primeiro e-mail, na proposta de horários e na confirmação. O rodapé de LGPD (SAIR) não muda. |
| Oferta | `config.json` (`oferta`) | "sites simples … atendimento automático por IA … pelo WhatsApp", sem "presença digital" nem "site profissional". O texto entra nos dois prompts. |
| Assunto em 4 formatos | `config.json` (`assuntoFormatos`), `_lib.js` (`formatoAssunto`) | "Uma ideia para {nome}", "Pergunta rápida sobre {nome}", "{nome} no Google de {cidade}", "Sobre o perfil de {nome} no Google". Quem escolhe é o código: hash FNV-1a do `lead.id`, misturado com fmix64, módulo 4. A escolha é determinística e, em 1.000 ids, os 4 formatos ficam entre 23% e 28%. |
| Prompt | `b_pedido_ia.js` | Primeira pessoa ("Olá! Sou o João, da Novax."). Observação neutra ("pesquisei … e o perfil apareceu sem site"). Uma frase com o que um site simples resolve para o ramo. Pedido final de sim ou não ("Faz sentido eu te explicar, em poucas linhas, como isso funcionaria para …?"). 55 a 95 palavras. O assunto chega pronto. Traz um exemplo bom e a lista do que não usar. Saem o convite para "reunião de diagnóstico gratuita de 30 minutos" e a "lacuna". |
| Validador (corpo) | `_lib.js` (`checarCorpoV2`), `b_validar_ia.js` | 300 a 900 caracteres (antes, 1.800) e 55 a 95 palavras; 3 a 5 frases; até 2 parágrafos. Exige "Sou o {nomePessoa}" na abertura e fecho com "?". Rejeita abertura "Olá, vi que"/"Olá, equipe", "lacuna", "dificulta", "resolveria", qualquer "reunião", duração em minutos, "gratuita", "Gostaria de", "presença digital", "profissional" junto de "site", formas com gênero ("convidá-lo/la/los", "(a)", "Prezado") e "vocês" quando o nome não indica mais de uma pessoa. Todas as checagens antigas continuam: fatos, nota, números por extenso, ramo, acentuação, elogio, promessa, placeholder, nome, cidade, "site" e homônimo. |
| Validador (assunto) | `_lib.js` (`checarAssuntoV2`), `b_validar_ia.js` | Exige o formato sorteado: partes fixas exatas, a cidade do lead e, no lugar de {nome}, de 1 a 4 palavras, todas tiradas do nome real. Rejeita dígito, "nota", "avaliações", "estrelas", "pode aparecer", "sem site", "ganha", "tem nota", "presença digital", "!", emoji e CAIXA ALTA. **Correção sem nova chamada:** quando o nome tem até 4 palavras, um assunto reprovado é trocado pelo formato montado pelo código (`assunto_corrigido: true`, como já era feito com "Presença digital para"). Com nome mais longo, a IA precisa da forma curta, então o assunto reprovado gera nova tentativa. |
| Fluxo de respostas | `c_pedido_ia.js`, `c_horarios.js` | O prompt de qualificação dizia "reforçando o convite para a reunião de diagnóstico". Esse convite não existe mais. Agora a resposta explica em poucas linhas e convida para uma conversa online, e "sim" à pergunta do e-mail conta como "interessado". A proposta de horários dizia "para a reunião de diagnóstico"; agora diz "para conversarmos". A duração da agenda (45 min) não muda. |

Testes:
- Suíte nova `workflow/tests/copy-v2.test.mjs`, com 80 testes e só empresas fictícias:
  - 6 textos bons em 6 ramos;
  - cada regra nova com um caso que reprova;
  - distribuição do sorteio em 1.000 ids;
  - prompt;
  - assinatura e rodapé de LGPD idênticos;
  - fluxo de respostas.
- `cota-fallback.test.mjs` e `fase1-robson2.test.mjs` foram ajustados: o texto de referência antigo agora é reprovado, o assunto padrão virou o formato sorteado e o rótulo de nicho é procurado fora do exemplo fixo do prompt.
- 8 suítes, 369 testes, 0 falhas. Lint do Robson e do watchdog: `refs inexistentes: []`, sem segredos.

Reprova dos 29 textos reais antigos (contagem, sem gravar texto): **29 de 29 reprovados**, no corpo e no assunto. Em todos: reunião, duração, "gratuita" e falta de primeira pessoa; no assunto, o formato não é o sorteado. Em 27 deles, "profissional" junto de "site"; em 17, abertura antiga; em 16, nota no assunto. `tests/simular-execucao.mjs` (replay da #507) reaproveita textos antigos e por isso deixa de servir para medir aprovação de texto.

## Medição com o modelo novo e assunto determinístico (21/10)
- **Modelo:** em produção desde 21/10, `openai/gpt-5.6-luna` com reserva `gpt-6-luna` e `data_collection: "deny"` (os modelos `:free` saíram do ar em 20/10).
- **1ª medição offline** (30 leads da #507): **83%** aprovado na 1ª tentativa e 97% em até 3. 7 das 8 reprovações eram de nomes com mais de 4 palavras, em que a IA escolhia a forma curta e o código não tinha como corrigir; a 8ª era palavra em CAIXA ALTA.
- **Correção (commit `d67e817`):**
  - **`nomeCurtoAssunto`:** o código faz a forma curta do nome. Corta no 1º separador (` - `, `|`, `/`, `(`, `,`), fica com até 4 palavras e não termina em conectivo nem título ("Dra.").
  - O prompt recebe o **assunto pronto para todo lead**, com a ordem de copiar exatamente, e a mesma forma curta para o corpo.
  - **`normalizarCaixa`:** palavra inteira em maiúsculas com 4+ letras vira Título antes de validar.
  - O assunto reprovado é **sempre** trocado pelo formato sorteado montado pelo código, sem nova chamada.
  - Dígito e caixa do próprio nome não contam como "nota" ou "CAIXA ALTA" ("Clínica 3D…").
  - O assunto padrão passa no próprio validador em **80 de 80 leads reais**.
- **2ª medição offline:** **100% (30/30) aprovado na 1ª tentativa**, 0 reprovações, US$ 0,010. Meta do João: ≥ 95%.

## Riscos
- **Taxa de aprovação na 1ª tentativa não medida:** não havia chave da OpenRouter em `docs/local/.env`, então não houve dry-run com IA.
  - As regras novas de forma podem reprovar mais com o modelo gratuito: 3 a 5 frases, fecho com "?" e 55 a 95 palavras.
  - O assunto não deve pesar: com nome de até 4 palavras, ele é corrigido em código.
  - Se a reprova subir, o primeiro ajuste é afrouxar o número de frases (3 a 6) ou a faixa de palavras (50 a 100) em `corpoLimites`, sem mexer nas regras de conteúdo.
- O exemplo do prompt é de advocacia. Num lead de outro ramo, se a IA copiar "escritórios", a checagem de ramo continua barrando "advocacia" sem base.

## Ordem do deploy (decisão do João, 21/10: deploy próprio em 26 ou 27/10, depois de 2 dias limpos do verificador novo)
1. Sem migration.
2. `git config core.autocrlf` = `false` → `node workflow/build.mjs` (esperado `9f4719001b6b` se nada mudou) → 8 suítes → `lint.mjs` (Robson e watchdog).
3. Merge de `robson2/copy-v2` (que já contém `places-paginacao`) em `main` → push → `bash workflow/deploy.sh robson`.
   - O watchdog tem o mesmo BUILD_ID, mas nada nele mudou. Só precisa de `deploy.sh watchdog` se o deploy for junto com o de `places-paginacao`.
4. Recarga pela UI (Unpublish → Publish), fora de 08:30–10:30 nos dias úteis.
5. Itens no export: `checarCorpoV2`, `checarAssuntoV2`, `assuntoFormatos`, `nomePessoa`, `João Novais` e "para conversarmos".

## Rollback
`git revert` dos commits da copy v2 → `node workflow/build.mjs` → testes → `bash workflow/deploy.sh robson` → recarga (Unpublish → Publish). Não há migration nem dado a desfazer.

Alternativa só por config (sem reverter código): não existe, porque as regras novas estão no validador. Reverter é o caminho.

## Aceite (somente leitura, depois do deploy)
1. **Primeiros 10 e-mails com o texto novo, conferidos à mão:**
   - assunto num dos 4 formatos, sem nota;
   - abertura "Olá! Sou o João, da Novax.";
   - fecho com a pergunta de sim ou não;
   - assinatura "João Novais";
   - rodapé de SAIR igual ao de antes.
   ```sql
   select enviado_em, nicho, assunto, left(corpo, 160) as inicio, right(split_part(corpo, E'\n\n—', 1), 120) as fim
   from prospeccao_envios
   where teste = false and tipo = 'prospeccao' and corpo like '%João Novais%'
   order by enviado_em limit 10;
   ```
2. **Reprova da IA:** no leitor da execução das 09:30, conte os itens de "Validar IA - e-mail" com `ok=false` na tentativa 1 sobre o total da tentativa 1. A linha de base de 07/10 é 59% de aprovação na 1ª tentativa. Veja também os motivos mais frequentes no `erro` e quantos itens saíram com `assunto_corrigido: true`.
3. **Respostas, copy antiga × nova, por nicho:** o corte é pela assinatura, então a consulta não depende do horário do deploy.
   ```sql
   with e as (
     select e.id, coalesce(e.nicho, l.nicho) as nicho,
            case when e.corpo like '%João Novais%' then 'v2' else 'v1' end as copy,
            (e.resposta_recebida_em is not null
              or exists (select 1 from prospeccao_respostas r where r.envio_id = e.id and r.teste = false)) as respondeu,
            exists (select 1 from prospeccao_respostas r where r.envio_id = e.id and r.teste = false
                    and r.acao_v1 in ('proposta_horarios', 'agendado')) as interessado,
            exists (select 1 from prospeccao_respostas r where r.envio_id = e.id and r.teste = false
                    and r.acao_v1 = 'optout') as optout
     from prospeccao_envios e join prospeccao_leads l on l.id = e.lead_id
     where e.teste = false and e.tipo = 'prospeccao'
   )
   select copy, nicho, count(*) as envios, count(*) filter (where respondeu) as respostas,
          round(100.0 * count(*) filter (where respondeu) / count(*), 1) as pct_resposta,
          count(*) filter (where interessado) as interessados, count(*) filter (where optout) as optouts
   from e group by copy, nicho order by nicho, copy;
   ```
   **Significância:** com ~5 envios por dia (15 a partir de 14/10), poucas semanas não bastam para separar o efeito do texto do acaso.
   - Exemplo: com taxa base de 2%, 100 envios de cada lado não distinguem 2% de 6% com confiança.
   - Trate a comparação como sinal, não como prova. Reavalie com pelo menos ~200 envios v2.
   - O que dá para conferir já na 1ª semana é a forma: os 10 e-mails do item 1 e a taxa de reprova do item 2.
