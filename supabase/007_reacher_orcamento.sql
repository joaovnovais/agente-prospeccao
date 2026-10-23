-- Orçamento diário GLOBAL de consultas ao Reacher (aditiva). Aplicar ANTES do deploy de 13/10.
-- 08/10: o Gmail passou a segurar o IP da VPS por volta da 37ª consulta do dia (23 do Robson + 19 de uma amostra avulsa);
-- em 06–08/10 o Robson sozinho usou 17, 22 e 23 sem problema. Teto: 25 por dia (BRT), para TODA origem:
-- Robson (variações do nome, candidatos da IA) e qualquer script/teste/amostra. O teto mora AQUI (constante na função),
-- não é parâmetro: quem chama não consegue pedir um teto maior. config.json → reacherLimiteDiario só espelha o valor.

-- 1) O contador usa a mesma tabela das outras cotas (linha 'reacher' por dia).
alter table public.prospeccao_uso_api drop constraint prospeccao_uso_api_servico_check;
alter table public.prospeccao_uso_api add constraint prospeccao_uso_api_servico_check
  check (servico in ('openrouter', 'google_places', 'reacher'));

-- 2) Registro de cada reserva (origem, quantidade, aceita ou não) e dos disjuntores do Robson (qtd 0).
create table public.prospeccao_reacher_reservas (
  id      bigserial primary key,
  em      timestamptz not null default now(),
  origem  text not null,
  qtd     integer not null check (qtd >= 0),
  ok      boolean not null
);
create index prospeccao_reacher_reservas_em_idx on public.prospeccao_reacher_reservas (em);
alter table public.prospeccao_reacher_reservas enable row level security;
revoke all on public.prospeccao_reacher_reservas from anon, authenticated;

-- 3) Reserva atômica de p_qtd consultas (tudo ou nada). Devolve ok, quantas já foram usadas hoje e o teto.
create function public.prospeccao_reservar_reacher(p_qtd integer, p_origem text)
returns table (ok boolean, usadas integer, limite integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite constant integer := 25;
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_usadas integer;
  v_ok boolean;
begin
  if p_qtd is null or p_qtd < 1 or p_qtd > v_limite then
    raise exception 'p_qtd fora de 1..%', v_limite;
  end if;
  insert into public.prospeccao_uso_api (servico, periodo, chamadas) values ('reacher', v_dia, 0)
    on conflict (servico, periodo) do nothing;
  update public.prospeccao_uso_api set chamadas = chamadas + p_qtd
   where servico = 'reacher' and periodo = v_dia and chamadas + p_qtd <= v_limite
  returning chamadas into v_usadas;
  v_ok := v_usadas is not null;
  if not v_ok then
    select chamadas into v_usadas from public.prospeccao_uso_api where servico = 'reacher' and periodo = v_dia;
  end if;
  insert into public.prospeccao_reacher_reservas (origem, qtd, ok) values (left(coalesce(nullif(p_origem, ''), '?'), 60), p_qtd, v_ok);
  return query select v_ok, v_usadas, v_limite;
end $$;
revoke all on function public.prospeccao_reservar_reacher(integer, text) from public, authenticated;
-- service_role: Robson (n8n). anon: scripts locais (docs/local), que não têm a chave de serviço. O pior uso indevido possível
-- é esgotar o teto do dia, o que só faz o Robson parar de consultar (falha segura); a função não lê nem expõe dados.
grant execute on function public.prospeccao_reservar_reacher(integer, text) to service_role, anon;
