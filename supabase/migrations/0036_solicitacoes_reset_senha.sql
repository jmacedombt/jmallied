-- Sistema Allied | Grupo J.Macedo
-- Migration 0036: "Esqueci minha senha" (tela de login) — a pessoa não
-- está autenticada, então não dá pra trocar a senha sozinha; só registra
-- um pedido, que fica pendente até um Administrador/Gerente/Diretor
-- resetar a senha dela pela tela Usuários (marca atendida sozinho nesse
-- momento — ver api/usuarios/[id]/resetar-senha).

create table if not exists public.solicitacoes_reset_senha (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'atendida')),
  criado_em timestamptz not null default now(),
  atendido_por uuid references public.usuarios (id),
  atendido_em timestamptz
);

comment on table public.solicitacoes_reset_senha is
  'Pedido de "esqueci minha senha" feito na tela de login (usuário não autenticado) — fica pendente até um administrador resetar a senha dessa pessoa pela tela Usuários.';

-- acha rápido se já existe pedido pendente de um usuário (evita duplicar
-- a cada clique) e alimenta a lista/sininho de pendências.
create index if not exists solicitacoes_reset_senha_usuario_pendente_idx
  on public.solicitacoes_reset_senha (usuario_id)
  where status = 'pendente';

-- RLS: leitura liberada pra autenticados (mesmo padrão do resto do
-- sistema — quem vê a lista na tela Usuários já é filtrado por cargo lá
-- no componente/página, não aqui). Escrita só acontece via rotina de
-- servidor com a service role key (a pessoa que abre o pop-up "Esqueci
-- minha senha" nem está autenticada, então não teria como escrever via
-- RLS mesmo).
alter table public.solicitacoes_reset_senha enable row level security;

drop policy if exists "solicitacoes_reset_senha_select_autenticados" on public.solicitacoes_reset_senha;
create policy "solicitacoes_reset_senha_select_autenticados"
  on public.solicitacoes_reset_senha
  for select
  to authenticated
  using (true);
