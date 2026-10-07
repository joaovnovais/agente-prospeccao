-- Robson — taxa de e-mail confirmado por nicho (aditiva: só cria uma view). Aplicar ANTES do deploy de 13/10 (cota/fallback).
-- O gargalo do Robson é a oferta de e-mail confirmado (~4/dia em 07/10), não a cota de IA nem o limite de envio:
-- esta view mostra, por nicho, quantos leads captados viram contato "safe" no Reacher. Lida pelo bloco semanal do watchdog.
create or replace view public.prospeccao_confirmacao_nicho
with (security_invoker = true) as
with l as (
  select coalesce(l.nicho, '(sem nicho)') as nicho, l.id, l.created_at, l.verificacao_codigo_em,
         (select min(c.created_at) from public.prospeccao_contatos c
           where c.lead_id = l.id and c.reacher_status = 'safe') as primeiro_safe_em
    from public.prospeccao_leads l
)
select
  nicho,
  count(*)::int                                                                           as captados,
  count(*) filter (where verificacao_codigo_em is not null or primeiro_safe_em is not null)::int as verificados,
  count(*) filter (where primeiro_safe_em is not null)::int                               as com_safe,
  -- Duas taxas: safe/captados é a principal (rendimento da captação); safe/verificados isola a etapa do Reacher.
  round(100.0 * count(*) filter (where primeiro_safe_em is not null) / nullif(count(*), 0), 1) as pct_safe_captados,
  round(100.0 * count(*) filter (where primeiro_safe_em is not null)
        / nullif(count(*) filter (where verificacao_codigo_em is not null or primeiro_safe_em is not null), 0), 1) as pct_safe_verificados,
  count(*) filter (where created_at >= now() - interval '7 days')::int                     as captados_7d,
  count(*) filter (where primeiro_safe_em >= now() - interval '7 days')::int               as com_safe_7d
from l
group by nicho;

revoke all on public.prospeccao_confirmacao_nicho from anon, authenticated;
