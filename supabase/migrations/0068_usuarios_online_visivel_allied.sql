-- Sistema Allied | Grupo J.Macedo
-- Migration 0068: "Usuários Online" passa a ser visível também pro
-- cargo ALLIED (pedido explícito, revertendo a decisão da migration
-- 0058) — mesmo indicador (bullet verde no cabeçalho) e mesma lista que
-- os demais cargos já veem, com nome, cargo e data/hora do último
-- login/atividade de quem está com o sistema aberto.
--
-- Só reescreve a função usuarios_online_listar() (migration 0058),
-- removendo a condição que zerava o resultado pra ALLIED — o resto
-- (tabela usuarios_atividade, usuarios_marcar_login/atividade) não muda.
create or replace function public.usuarios_online_listar()
returns table (
  id uuid,
  nome text,
  sobrenome text,
  cargo text,
  ultimo_login_em timestamptz,
  ultima_atividade_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.nome, u.sobrenome, u.cargo, ua.ultimo_login_em, ua.ultima_atividade_em
  from public.usuarios_atividade ua
  join public.usuarios u on u.id = ua.usuario_id
  where ua.ultima_atividade_em > now() - interval '5 minutes'
  order by ua.ultima_atividade_em desc;
$$;

comment on function public.usuarios_online_listar() is
  'Lista quem está "online agora" (heartbeat nos últimos 5 minutos) — visível pra todo login, inclusive ALLIED desde a migration 0068.';
