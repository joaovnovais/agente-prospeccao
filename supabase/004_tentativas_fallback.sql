-- PROPOSTA da auditoria 2026-10-05 (NÃO aplicada). Aplicar ANTES do deploy do patch A3.
-- Conta quantas vezes o fallback terminou inconclusivo (todos os candidatos unknown) para o lead.
alter table public.prospeccao_leads add column tentativas_fallback smallint not null default 0;
-- Ordenações usadas pelo workflow (fila de verificação e fila fallback ordenam por updated_at).
create index prospeccao_leads_fila_updated_idx on public.prospeccao_leads (status, updated_at);

-- DECISÃO PENDENTE (João): recuperar os leads descartados só por "unknown". Prévia (só SELECT):
--   select id, nome, motivo_revisao from prospeccao_leads
--    where status = 'sem_email' and motivo_revisao ilike '%=unknown%'
--      and motivo_revisao not ilike '%=invalid%' and motivo_revisao not ilike '%=safe%';   -- 14 leads em 05/10
-- Recuperação proposta (rodar só após aprovação):
--   update prospeccao_leads set status = 'novo', tentativas_fallback = 1,
--          motivo_revisao = 'recuperado na auditoria 2026-10-05: ' || coalesce(motivo_revisao, '')
--    where <mesma condição acima>;
