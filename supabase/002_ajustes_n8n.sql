-- Ajustes p/ consumo pelo n8n via PostgREST.

-- 1) RPC de cota devolve linha {ok} (n8n lê objeto; booleano cru vira item estranho).
drop function public.prospeccao_reservar_cota(text, integer);
create function public.prospeccao_reservar_cota(p_servico text, p_limite integer)
returns table (ok boolean)
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

  return query select coalesce(v_ok, false);
end $$;
revoke execute on function public.prospeccao_reservar_cota(text, integer) from public, anon, authenticated;
grant  execute on function public.prospeccao_reservar_cota(text, integer) to service_role;

-- 2) Envios de teste (redirecionados) não contam no ramp-up nem nas métricas;
--    resposta_message_id evita processar a mesma resposta duas vezes.
alter table public.prospeccao_envios
  add column teste boolean not null default false,
  add column resposta_message_id text unique;

-- 3) Status do dia em uma linha: envios reais hoje, envios de teste hoje, primeiro envio real (início do ramp-up).
drop view public.prospeccao_envios_hoje;
create view public.prospeccao_status_envio
with (security_invoker = true) as
select
  count(*) filter (where not teste and (enviado_em at time zone 'America/Sao_Paulo')::date
                                     = (now() at time zone 'America/Sao_Paulo')::date)::int as total_hoje,
  count(*) filter (where teste and (enviado_em at time zone 'America/Sao_Paulo')::date
                                 = (now() at time zone 'America/Sao_Paulo')::date)::int     as total_hoje_teste,
  min(enviado_em) filter (where not teste)                                                   as primeiro_envio
from public.prospeccao_envios
where tipo = 'prospeccao' and status = 'enviado';

create or replace view public.prospeccao_taxa_resposta
with (security_invoker = true) as
select l.nicho, l.cidade, l.estado,
       count(distinct e.lead_id)                                                    as leads_contatados,
       count(distinct e.lead_id) filter (where e.resposta_recebida_em is not null)  as leads_responderam,
       round(100.0 * count(distinct e.lead_id) filter (where e.resposta_recebida_em is not null)
             / nullif(count(distinct e.lead_id), 0), 1)                             as taxa_resposta_pct
  from public.prospeccao_envios e
  join public.prospeccao_leads l on l.id = e.lead_id
 where e.tipo = 'prospeccao' and e.status = 'enviado' and not e.teste
 group by l.nicho, l.cidade, l.estado;

revoke all on public.prospeccao_status_envio, public.prospeccao_taxa_resposta from anon, authenticated;
