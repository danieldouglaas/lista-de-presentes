-- Execute este script no SQL Editor do seu projeto Supabase
-- para criar a tabela compartilhada do Mural de Presentes.

create table if not exists public.wishlist_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sizes text default '',
  wishes jsonb not null default '[]'::jsonb,
  avoid text default '',
  pin text default '',
  updated_at timestamptz not null default now()
);

-- Habilita Row Level Security (RLS)
alter table public.wishlist_entries enable row level security;

-- Políticas abertas para uso familiar via link público no GitHub Pages
-- (qualquer pessoa com o link pode ler, adicionar, atualizar e remover listas)
create policy "Permitir leitura pública"
  on public.wishlist_entries
  for select
  to anon, authenticated
  using (true);

create policy "Permitir inserção pública"
  on public.wishlist_entries
  for insert
  to anon, authenticated
  with check (true);

create policy "Permitir atualização pública"
  on public.wishlist_entries
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Permitir exclusão pública"
  on public.wishlist_entries
  for delete
  to anon, authenticated
  using (true);

-- Opcional: ativa atualização em tempo real na tela da família
alter publication supabase_realtime add table public.wishlist_entries;
