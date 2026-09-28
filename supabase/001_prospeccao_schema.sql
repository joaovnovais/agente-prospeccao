-- NOVAX - Agente de Prospecção: schema isolado (prefixo prospeccao_).
-- Não referencia nem altera as tabelas da Claudia (pacientes, conversas, agendamentos).
-- RLS ligado sem policies: só a service_role (credencial "Supabase - Prospeccao" no n8n) acessa.

create table public.prospeccao_leads (
  id                 uuid primary key default gen_random_uuid(),
  place_id           text not null unique,            -- Google Places id (dedupe entre semanas)
  nome               text not null,
  nome_normalizado   text not null,                   -- lower/sem acento, p/ bater com a lista de exclusão
  nicho              text not null,
  cidade             text not null,
  estado             text not null check (estado in ('GO','SC')),
  endereco           text,
  telefone           text,
  google_maps_url    text,
  rating             numeric(2,1),
  total_avaliacoes   integer,
  semana_ciclo       smallint,                        -- 1..4 da rotação
  status             text not null default 'novo' check (status in (
                       'novo','sem_email','email_enviado','respondeu','reuniao_agendada',
                       'fechado','perdido','revisao_manual','descartado')),
  motivo_revisao     text,                            -- preenchido quando a IA falha/recusa
  trello_card_id     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index prospeccao_leads_status_idx on public.prospeccao_leads (status);
create index prospeccao_leads_nicho_cidade_idx on public.prospeccao_leads (nicho, cidade);

create table public.prospeccao_contatos (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references public.prospeccao_leads(id) on delete set null, -- null = bloqueio avulso
  email              text not null unique check (email = lower(email)),
  origem             text not null default 'ia_candidato' check (origem in ('ia_candidato','resposta','manual')),
  reacher_status     text check (reacher_status in ('safe','risky','invalid','unknown')),
  reacher_raw        jsonb,
  verificado_em      timestamptz,
  -- Lista de bloqueio LGPD: consultada antes de QUALQUER envio.
  bloqueado          boolean not null default false,
  bloqueado_motivo   text,                            -- 'descadastro', 'pediu_para_parar', 'bounce', 'manual'
  bloqueado_em       timestamptz,
  created_at         timestamptz not null default now()
);
create index prospeccao_contatos_lead_idx on public.prospeccao_contatos (lead_id);
create index prospeccao_contatos_bloqueado_idx on public.prospeccao_contatos (email) where bloqueado;

create table public.prospeccao_envios (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid not null references public.prospeccao_leads(id) on delete cascade,
  contato_id            uuid not null references public.prospeccao_contatos(id) on delete cascade,
  tipo                  text not null check (tipo in ('prospeccao','proposta_reuniao','convite_reuniao')),
  assunto               text not null,
  corpo                 text not null,
  message_id            text unique,                  -- Message-ID do SMTP, usado p/ casar respostas via IMAP
  status                text not null default 'enviado' check (status in ('enviado','erro')),
  erro                  text,
  resposta_recebida_em  timestamptz,
  resposta_texto        text,
  classificacao_ia      jsonb,                        -- saída validada do qualificador
  enviado_em            timestamptz not null default now()
);
create index prospeccao_envios_lead_idx on public.prospeccao_envios (lead_id);
create index prospeccao_envios_contato_idx on public.prospeccao_envios (contato_id);
create index prospeccao_envios_enviado_em_idx on public.prospeccao_envios (enviado_em);

-- Contador de uso de APIs gratuitas/limitadas (OpenRouter diário, Places mensal).
create table public.prospeccao_uso_api (
  servico     text not null check (servico in ('openrouter','google_places')),
  periodo     date not null,                          -- dia (openrouter) ou 1º dia do mês (places)
  chamadas    integer not null default 0,
  primary key (servico, periodo)
);

-- Reserva atômica de cota: retorna true e incrementa se ainda cabe; false se estourou.
create or replace function public.prospeccao_reservar_cota(p_servico text, p_limite integer)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo date := case when p_servico = 'google_places'
                         then date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date
                         else (now() at time zone 'America/Sao_Paulo')::date end;
  v_ok boolean;
begin
  insert into public.prospeccao_uso_api (servico, periodo, chamadas)
  values (p_servico, v_periodo, 0)
  on conflict (servico, periodo) do nothing;

  update public.prospeccao_uso_api
     set chamadas = chamadas + 1
   where servico = p_servico and periodo = v_periodo and chamadas < p_limite
  returning true into v_ok;

  return coalesce(v_ok, false);
end $$;

-- Envios de prospecção já feitos hoje (p/ ramp-up 5/10/15-20 por dia).
create or replace view public.prospeccao_envios_hoje
with (security_invoker = true) as
select count(*)::int as total
  from public.prospeccao_envios
 where tipo = 'prospeccao' and status = 'enviado'
   and (enviado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;

-- Taxa de resposta por nicho × cidade (priorização a partir da semana 5).
create or replace view public.prospeccao_taxa_resposta
with (security_invoker = true) as
select l.nicho, l.cidade, l.estado,
       count(distinct e.lead_id)                                                    as leads_contatados,
       count(distinct e.lead_id) filter (where e.resposta_recebida_em is not null)  as leads_responderam,
       round(100.0 * count(distinct e.lead_id) filter (where e.resposta_recebida_em is not null)
             / nullif(count(distinct e.lead_id), 0), 1)                             as taxa_resposta_pct
  from public.prospeccao_envios e
  join public.prospeccao_leads l on l.id = e.lead_id
 where e.tipo = 'prospeccao' and e.status = 'enviado'
 group by l.nicho, l.cidade, l.estado;

create or replace function public.prospeccao_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger prospeccao_leads_updated_at
before update on public.prospeccao_leads
for each row execute function public.prospeccao_touch_updated_at();

alter table public.prospeccao_leads    enable row level security;
alter table public.prospeccao_contatos enable row level security;
alter table public.prospeccao_envios   enable row level security;
alter table public.prospeccao_uso_api  enable row level security;

-- Nada exposto para anon/authenticated; só service_role.
revoke all on public.prospeccao_leads, public.prospeccao_contatos, public.prospeccao_envios,
              public.prospeccao_uso_api, public.prospeccao_envios_hoje, public.prospeccao_taxa_resposta
  from anon, authenticated;
revoke execute on function public.prospeccao_reservar_cota(text, integer) from public, anon, authenticated;
grant  execute on function public.prospeccao_reservar_cota(text, integer) to service_role;
revoke execute on function public.prospeccao_touch_updated_at() from public, anon, authenticated;
