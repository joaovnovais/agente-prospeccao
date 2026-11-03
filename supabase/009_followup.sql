-- Robson 2.0 — Fase 2 (follow-up, prspFollowUp001). Aditiva: só cria uma tabela nova. Aplicar ANTES do deploy do módulo.
-- Estágio "sombra": o módulo calcula quem receberia o toque 2/3, gera o texto e grava aqui, sem enviar nada.
-- Também guarda as falhas de validação do texto em qualquer estágio (para a aprovação do João).
create table public.prospeccao_followup_sombra (
  id               uuid primary key default gen_random_uuid(),
  dia              date not null,                      -- dia BRT da execução
  estagio          text not null,                      -- sombra | teste | ligado
  lead_id          uuid not null references public.prospeccao_leads(id) on delete cascade,
  envio_inicial_id uuid references public.prospeccao_envios(id) on delete set null,
  envio_pai_id     uuid references public.prospeccao_envios(id) on delete set null,
  toque            smallint not null check (toque in (2, 3)),
  dias_uteis       smallint,                           -- dias úteis desde o toque 1
  assunto          text,
  corpo            text,
  modelo           text,
  erro             text,                               -- texto reprovado pelo validador / sem texto (teto da sombra)
  created_at       timestamptz not null default now(),
  unique (dia, lead_id, toque)
);
create index prospeccao_followup_sombra_dia_idx on public.prospeccao_followup_sombra (dia);
alter table public.prospeccao_followup_sombra enable row level security;
revoke all on public.prospeccao_followup_sombra from anon, authenticated;
