-- Suporte a "bloquear usuário" (em vez de excluir de vez — várias
-- tabelas referenciam usuarios.id no histórico de ações, então excluir
-- o cadastro quebraria essas referências). Bloquear só impede o login
-- (via ban no Supabase Auth) e mantém o cadastro/histórico intacto.
alter table public.usuarios
  add column if not exists bloqueado_em timestamptz,
  add column if not exists bloqueado_por uuid references public.usuarios (id);

comment on column public.usuarios.bloqueado_em is
  'Quando o login desse usuário foi bloqueado. NULL = usuário ativo.';
