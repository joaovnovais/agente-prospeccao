-- Robson 2.0 — Fase 1 (aditiva). Aplicar ANTES do deploy do build da Fase 1.
-- Nada é removido nem muda de significado: colunas novas têm default/null, a regra de "tipo" só ganha valores
-- e a view de status ganha colunas no fim (as 3 antigas continuam com o mesmo cálculo).

-- 1) Respostas brutas recebidas pelo IMAP (motor v1 grava; o módulo Respostas v2 lê e classifica).
create table public.prospeccao_respostas (
  id                uuid primary key default gen_random_uuid(),
  recebido_em       timestamptz not null default now(),
  message_id        text unique,                       -- Message-ID da resposta (dedupe do IMAP)
  in_reply_to       text,
  references_raw    text,
  remetente         text,
  assunto           text,
  corpo_texto       text,
  envio_id          uuid references public.prospeccao_envios(id) on delete set null,
  lead_id           uuid references public.prospeccao_leads(id) on delete set null,
  acao_v1           text,                              -- o que o fluxo atual fez (optout, proposta_horarios, agendado, revisao_manual, v2_registrado…)
  processado_v2_em  timestamptz,
  categoria_v2      text,
  confianca_v2      numeric(3,2),
  rascunho_v2       text,
  acao_v2           text,
  teste             boolean not null default false,
  created_at        timestamptz not null default now()
);
create index prospeccao_respostas_pendentes_idx on public.prospeccao_respostas (recebido_em) where processado_v2_em is null;
create index prospeccao_respostas_lead_idx on public.prospeccao_respostas (lead_id);

-- 2) Envios: o envio inicial continua tipo 'prospeccao'; a regra só passa a aceitar os tipos do 2.0.
alter table public.prospeccao_envios drop constraint prospeccao_envios_tipo_check;
alter table public.prospeccao_envios add constraint prospeccao_envios_tipo_check
  check (tipo in ('prospeccao', 'proposta_reuniao', 'convite_reuniao', 'followup', 'resposta', 'lembrete'));
alter table public.prospeccao_envios
  add column toque          smallint not null default 1,
  add column envio_pai_id   uuid references public.prospeccao_envios(id) on delete set null,
  add column origem_modulo  text not null default 'robson_v1',
  add column nicho          text;
-- Backfill não destrutivo: nicho do envio = nicho do lead (só onde está vazio).
update public.prospeccao_envios e set nicho = l.nicho from public.prospeccao_leads l where l.id = e.lead_id and e.nicho is null;

-- 3) Leads: etapa do funil, retomada ("agora não") e o tipo do estabelecimento segundo o Google Places.
alter table public.prospeccao_leads
  add column etapa_funil  text,
  add column retomar_em   timestamptz,
  add column tipo_google  text,
  add column tipos_google text[];

-- 4) Limite diário compartilhado. Colunas antigas (total_hoje, total_hoje_teste, primeiro_envio) mantêm o cálculo
--    de antes (só tipo 'prospeccao'); as novas contam os outros tipos (envios reais, status enviado, dia BRT).
create or replace view public.prospeccao_status_envio
with (security_invoker = true) as
with hoje as (
  select e.*, (e.enviado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date as eh_hoje
    from public.prospeccao_envios e
   where e.status = 'enviado'
)
select
  count(*) filter (where tipo = 'prospeccao' and not teste and eh_hoje)::int                                         as total_hoje,
  count(*) filter (where tipo = 'prospeccao' and teste and eh_hoje)::int                                             as total_hoje_teste,
  min(enviado_em) filter (where tipo = 'prospeccao' and not teste)                                                   as primeiro_envio,
  count(*) filter (where tipo = 'followup' and not teste and eh_hoje)::int                                           as followup_hoje,
  count(*) filter (where tipo in ('resposta', 'proposta_reuniao', 'convite_reuniao', 'lembrete') and not teste and eh_hoje)::int as respostas_hoje,
  count(*) filter (where not teste and eh_hoje)::int                                                                 as total_todos_hoje
from hoje;

alter table public.prospeccao_respostas enable row level security;
revoke all on public.prospeccao_respostas, public.prospeccao_status_envio from anon, authenticated;
