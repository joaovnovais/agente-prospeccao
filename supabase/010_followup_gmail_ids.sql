-- Robson 2.0 — Fase 2 (follow-up). Aditiva: só cria 2 colunas novas, nulas, em prospeccao_envios. Aplicar ANTES do deploy.
-- 17–18/11: a Gmail API (users.messages.send) troca o Message-ID que o follow-up gera pelo dela (<CAO8_…@mail.gmail.com>),
-- e com o escopo gmail.send não dá para ler o Message-ID real depois. A resposta do envio devolve id e threadId:
-- gmail_id        = id da mensagem na caixa da Novax (abre a mensagem pela API / conector);
-- gmail_thread_id = conversa da Novax; o toque 3 é enviado com esse threadId para ficar na mesma conversa do toque 2.
-- Para follow-ups enviados a partir desta versão, message_id fica nulo (o ID gerado não é o que o lead recebe).
alter table public.prospeccao_envios add column if not exists gmail_id text;
alter table public.prospeccao_envios add column if not exists gmail_thread_id text;
comment on column public.prospeccao_envios.gmail_id is 'Follow-up: id da mensagem devolvido por users.messages.send (caixa da Novax).';
comment on column public.prospeccao_envios.gmail_thread_id is 'Follow-up: threadId devolvido por users.messages.send; o toque 3 é enviado nesse threadId.';
-- Reversão (só se o João pedir; apaga os dados das colunas):
-- alter table public.prospeccao_envios drop column if exists gmail_thread_id;
-- alter table public.prospeccao_envios drop column if exists gmail_id;
