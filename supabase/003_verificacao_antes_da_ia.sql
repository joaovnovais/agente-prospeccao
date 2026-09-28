-- Inversão aprovada: Reacher verifica as variações do nome ANTES de chamar a IA.

-- Quando as variações do nome deste lead já foram verificadas (evita re-checar todo dia).
alter table public.prospeccao_leads add column verificacao_codigo_em timestamptz;
create index prospeccao_leads_fila_idx on public.prospeccao_leads (status, verificacao_codigo_em);

-- Nova origem de contato: variação gerada pelo código a partir do nome exato.
alter table public.prospeccao_contatos drop constraint prospeccao_contatos_origem_check;
alter table public.prospeccao_contatos add constraint prospeccao_contatos_origem_check
  check (origem in ('ia_candidato', 'codigo_nome', 'resposta', 'manual'));
