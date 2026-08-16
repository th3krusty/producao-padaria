-- Execute este script no Supabase: Dashboard do projeto → SQL Editor → New query.
-- Cria a tabela usada pelo dashboard para salvar todo o estado (meta, período,
-- lançamentos de produção, OEE, roteiro da qualidade, supervisor, tema, etc.)

create table if not exists public.dashboard_kv (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Habilita Row Level Security (obrigatório antes de criar policies).
alter table public.dashboard_kv enable row level security;

-- Como esse dashboard é de uso interno (um supervisor/turno, sem login de
-- usuários finais), liberamos leitura e escrita para a chave "anon" (a
-- mesma usada pelo app no navegador, via VITE_SUPABASE_ANON_KEY).
-- Se no futuro você adicionar autenticação de usuários, troque estas
-- policies por regras baseadas em auth.uid().
drop policy if exists "dashboard_kv_select_anon" on public.dashboard_kv;
create policy "dashboard_kv_select_anon"
  on public.dashboard_kv for select
  to anon
  using (true);

drop policy if exists "dashboard_kv_insert_anon" on public.dashboard_kv;
create policy "dashboard_kv_insert_anon"
  on public.dashboard_kv for insert
  to anon
  with check (true);

drop policy if exists "dashboard_kv_update_anon" on public.dashboard_kv;
create policy "dashboard_kv_update_anon"
  on public.dashboard_kv for update
  to anon
  using (true)
  with check (true);

-- Índice para consultas por data de atualização (útil se algum dia você
-- quiser auditar/depurar quando cada chave foi salva pela última vez).
create index if not exists dashboard_kv_atualizado_em_idx
  on public.dashboard_kv (atualizado_em desc);
