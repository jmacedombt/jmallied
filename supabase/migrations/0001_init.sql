-- Sistema Allied | Grupo J.Macedo
-- Migration inicial: tabela de usuários + controle de acesso

create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  sobrenome text not null,
  usuario text not null unique,
  email text not null,
  telefone text,
  cargo text not null check (
    cargo in ('Diretor', 'Gerente', 'Supervisor', 'Técnico', 'Estoque', 'Operacional')
  ),
  is_master boolean not null default false,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.usuarios is
  'Perfil de cada pessoa com acesso ao sistema Allied. id = auth.users.id.';

-- mantém updated_at em dia
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists usuarios_set_updated_at on public.usuarios;
create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row
  execute function public.set_updated_at();

-- RLS: por enquanto, qualquer usuário autenticado pode ler a lista de
-- usuários (necessário para o painel). Escrita só acontece via rotina de
-- servidor com a service role key, que ignora RLS. Quando as regras de
-- cargo forem definidas, refinar estas policies (ex: só Diretor/Gerente
-- podem ver tudo, os demais só o próprio registro).
alter table public.usuarios enable row level security;

drop policy if exists "usuarios_select_autenticados" on public.usuarios;
create policy "usuarios_select_autenticados"
  on public.usuarios
  for select
  to authenticated
  using (true);

-- cada usuário pode atualizar apenas o próprio registro (usado hoje só
-- para marcar must_change_password = false após a troca de senha)
drop policy if exists "usuarios_update_proprio" on public.usuarios;
create policy "usuarios_update_proprio"
  on public.usuarios
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
