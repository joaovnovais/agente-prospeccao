-- Robson — fila de verificação priorizada pela taxa de e-mail confirmado do nicho (28/10, ajuste de rendimento da Verifalia).
-- Aditiva: só cria views. Aplicar ANTES do deploy do ajuste.
-- Com 25 créditos/dia, cada crédito rende mais em nicho com mais e-mail confirmado (em 28/10: pet 50%, oficina 40%, salão 8%).
-- Taxa suavizada pela média geral (peso 4): nicho sem histórico entra com a média (nem no topo nem esquecido) e
-- nicho com poucos leads não salta para o topo por acaso. Só conta e-mail confirmado pelas variações do nome (codigo_nome),
-- que é o que esta fila gasta.

create or replace view public.prospeccao_taxa_variacao_nicho
with (security_invoker = true) as
with v as (
  select l.nicho,
         exists (select 1 from public.prospeccao_contatos c
                  where c.lead_id = l.id and c.origem = 'codigo_nome' and c.reacher_status = 'safe') as safe
    from public.prospeccao_leads l
   where l.verificacao_codigo_em is not null
), g as (
  select coalesce(avg(case when safe then 1.0 else 0.0 end), 0.2) as media from v
)
select v.nicho,
       count(*)::int                         as verificados,
       count(*) filter (where v.safe)::int   as com_email,
       round((count(*) filter (where v.safe) + 4 * g.media) / (count(*) + 4), 4) as taxa_suavizada
  from v cross join g
 group by v.nicho, g.media;

create or replace view public.prospeccao_fila_verificacao
with (security_invoker = true) as
select l.*,
       coalesce(t.taxa_suavizada,
                (select coalesce(avg(case when exists (select 1 from public.prospeccao_contatos c
                                                       where c.lead_id = x.id and c.origem = 'codigo_nome' and c.reacher_status = 'safe')
                                          then 1.0 else 0.0 end), 0.2)
                   from public.prospeccao_leads x where x.verificacao_codigo_em is not null)) as taxa_nicho
  from public.prospeccao_leads l
  left join public.prospeccao_taxa_variacao_nicho t on t.nicho = l.nicho
 where l.status = 'novo' and l.verificacao_codigo_em is null;

revoke all on public.prospeccao_taxa_variacao_nicho, public.prospeccao_fila_verificacao from anon, authenticated;
