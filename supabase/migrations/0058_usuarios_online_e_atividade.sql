-- Sistema Allied | Grupo J.Macedo
-- Migration 0058: "Usuários Online" (visível pra todo login, menos
-- ALLIED) + base pro logout automático por inatividade (1h, front-end).
--
-- Nova tabela `usuarios_atividade`, separada de `usuarios` (que já tem
-- select liberado geral desde a migration 0001) — assim não precisa
-- mexer em nenhuma policy existente: ninguém lê/escreve essa tabela
-- direto (RLS ligado, sem NENHUMA policy — nega tudo por padrão, até
-- pra quem tem sessão válida), só passa pelas 3 funções abaixo
-- (security definer, que ignoram RLS):
--   - usuarios_marcar_login(): chamada uma vez, logo depois do login
--     (ver LoginForm.tsx) — grava ultimo_login_em/ultima_atividade_em.
--   - usuarios_marcar_atividade(): "heartbeat" chamado periodicamente
--     enquanto a pessoa está com o sistema aberto (ver AppShell.tsx) —
--     só atualiza ultima_atividade_em.
--   - usuarios_online_listar(): lista quem está com atividade dentro da
--     janela de "online agora" (5 minutos sem heartbeat = considerado
--     offline, cai da lista sozinho, sem precisar de logout explícito
--     pra "desaparecer"). Pedido explícito: ninguém com cargo ALLIED
--     enxerga essa lista — a própria função devolve vazio pra esse
--     cargo (mesmo padrão de bloqueio já usado em orcamentos/
--     bid_relatorio_log, reaproveitando cargo_atual() da migration
--     0035), então nem depende do menu escondido pra valer.
--
-- O logout automático em si (1h sem interação do navegador — mouse,
-- teclado, clique, scroll) é tratado inteiramente no front-end
-- (InactivityGuard.tsx): não tem como isso ser reforçado no banco, já
-- que "sem uso" é um conceito de tela, não de linha de dado.
create table if not exists public.usuarios_atividade (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  ultimo_login_em timestamptz,
  ultima_atividade_em timestamptz
);

comment on table public.usuarios_atividade is
  'Data/hora do último login e da última atividade (heartbeat) de cada usuário — usada pela tela "Usuários Online" (visível pra todo login, menos ALLIED) e pelo logout automático por inatividade. RLS liga sem nenhuma policy (nega tudo direto); só as funções security definer abaixo tocam essa tabela.';

alter table public.usuarios_atividade enable row level security;

-- grava/atualiza o login de quem está chamando (auth.uid()) — chamada
-- uma vez, logo depois de "Entrar" dar certo.
create or replace function public.usuarios_marcar_login()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usuarios_atividade (usuario_id, ultimo_login_em, ultima_atividade_em)
  values (auth.uid(), now(), now())
  on conflict (usuario_id) do update
    set ultimo_login_em = excluded.ultimo_login_em,
        ultima_atividade_em = excluded.ultima_atividade_em;
$$;

grant execute on function public.usuarios_marcar_login() to authenticated;

-- "heartbeat" — só atualiza ultima_atividade_em de quem está chamando;
-- se por algum motivo ainda não existir linha (ex: sessão antiga, de
-- antes dessa migration), cria com login = agora também, pra não ficar
-- com ultimo_login_em nulo.
create or replace function public.usuarios_marcar_atividade()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usuarios_atividade (usuario_id, ultimo_login_em, ultima_atividade_em)
  values (auth.uid(), now(), now())
  on conflict (usuario_id) do update
    set ultima_atividade_em = excluded.ultima_atividade_em;
$$;

grant execute on function public.usuarios_marcar_atividade() to authenticated;

-- lista quem está "online agora" (heartbeat nos últimos 5 minutos) —
-- pedido explícito: cargo ALLIED nunca vê essa lista (a condição do
-- cargo_atual() abaixo vale igual pra toda linha, então pra ALLIED o
-- resultado é sempre vazio, não só filtrado).
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
    and coalesce(public.cargo_atual(), '') <> 'ALLIED'
  order by ua.ultima_atividade_em desc;
$$;

grant execute on function public.usuarios_online_listar() to authenticated;
