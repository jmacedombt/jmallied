-- Sistema Allied | Grupo J.Macedo
-- Migration 0035: cargo ALLIED (login externo, só consulta) + proteção
-- real de custo/BID no banco.
--
-- ALLIED é pra login de gente de fora (o parceiro Allied): só consulta,
-- nenhuma ação; só enxerga Operacional > Painel e a nova tela Backlog;
-- e em hipótese nenhuma pode ver custo de peça / BID — só o valor de
-- venda (o que cobramos deles) e a mão de obra cobrada. Pra isso não
-- depender só de esconder coisa na tela (o que um usuário técnico
-- poderia contornar abrindo o F12 e lendo a API do Supabase direto),
-- a proteção é feita aqui no banco:
--   1) política RESTRICTIVE barra ALLIED de ler a tabela orcamentos
--      direto — só passa pelas funções "seguras" abaixo;
--   2) as funções são security definer e nunca selecionam nenhuma
--      coluna de custo, devolvendo só posição/código/valor de venda de
--      cada peça (lido de dentro de validacao_snapshot) e os totais
--      "o que cobramos" (venda de peças + mão de obra).

-- 1) novo cargo -------------------------------------------------------
alter table public.usuarios drop constraint if exists usuarios_cargo_check;
alter table public.usuarios add constraint usuarios_cargo_check check (
  cargo in ('Diretor', 'Gerente', 'Supervisor', 'Técnico', 'Estoque', 'Operacional', 'ALLIED')
);

-- 2) cargo do usuário logado, sem depender da RLS de usuarios ---------
create or replace function public.cargo_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cargo from public.usuarios where id = auth.uid();
$$;

grant execute on function public.cargo_atual() to authenticated;

-- 3) bloqueio real: ALLIED não lê a tabela orcamentos direto ----------
-- (política restritiva combina em "E" com a permissiva já existente
-- "orcamentos_select_autenticados" — pra ALLIED o resultado dá sempre
-- falso, mesmo a permissiva liberando geral pros demais cargos).
drop policy if exists "orcamentos_bloqueio_allied" on public.orcamentos;
create policy "orcamentos_bloqueio_allied"
  on public.orcamentos
  as restrictive
  for select
  to authenticated
  using (coalesce(public.cargo_atual(), '') <> 'ALLIED');

-- 4) contagem por status (cards do Painel Operacional) — sem nenhum
--    valor de custo, então pode virar security definer sem problema; é
--    o que faz o Painel continuar funcionando pra ALLIED mesmo com o
--    bloqueio acima (a versão antiga rodava com o privilégio de quem
--    chamou, e passaria a devolver tudo zerado pra ALLIED).
create or replace function public.orcamentos_metricas_status()
returns table (status_operacional text, quantidade bigint)
language sql
stable
security definer
set search_path = public
as $$
  select status_operacional, count(*) as quantidade
  from public.orcamentos
  group by status_operacional;
$$;

-- 5) listagem segura pra ALLIED (nenhuma coluna de custo/BID) ---------
create or replace function public.orcamentos_allied_listar(p_status text default null)
returns table (
  id uuid,
  os_reparadora text,
  trade_allied text,
  os_care_allied text,
  modelo_comercial text,
  sku text,
  descricao_completa text,
  status_operacional text,
  data_reconhecimento date,
  pedido_peca_feito boolean,
  peca_chegou_em timestamptz,
  reparo_confirmado_em timestamptz,
  resultado_aprovacao_allied text,
  quantidade_pecas integer,
  venda_total_pecas numeric,
  mao_de_obra_cobrada numeric,
  pecas jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.os_reparadora,
    o.trade_allied,
    o.os_care_allied,
    o.modelo_comercial,
    o.sku,
    o.descricao_completa,
    o.status_operacional,
    o.data_reconhecimento,
    o.pedido_peca_feito,
    o.peca_chegou_em,
    o.reparo_confirmado_em,
    o.resultado_aprovacao_allied,
    nullif(o.validacao_snapshot->>'quantidadePecas', '')::int as quantidade_pecas,
    nullif(o.validacao_snapshot->>'vendaTotalPecas', '')::numeric as venda_total_pecas,
    nullif(o.validacao_snapshot->>'maoDeObra', '')::numeric as mao_de_obra_cobrada,
    (
      select jsonb_agg(
        jsonb_build_object(
          'posicao', peca->>'posicao',
          'codigo', peca->>'codigo',
          'vendaPeca', nullif(peca->>'vendaPeca', '')::numeric
        )
        order by ordem
      )
      from jsonb_array_elements(coalesce(o.validacao_snapshot->'pecas', '[]'::jsonb)) with ordinality as t(peca, ordem)
    ) as pecas
  from public.orcamentos o
  where p_status is null or o.status_operacional = p_status;
$$;

grant execute on function public.orcamentos_allied_listar(text) to authenticated;

-- 6) resumo pra tela Backlog (quantidade + R-TAT médio por status
--    numerado) — sem nenhum valor de custo, serve tanto pra ALLIED
--    quanto pra equipe interna, sem precisar de duas versões.
create or replace function public.orcamentos_backlog_resumo()
returns table (
  status_operacional text,
  quantidade bigint,
  media_rtat_dias numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.status_operacional,
    count(*) as quantidade,
    avg(
      (now() at time zone 'America/Sao_Paulo')::date - o.data_reconhecimento
    )::numeric as media_rtat_dias
  from public.orcamentos o
  where o.status_operacional ~ '^[0-9]'
  group by o.status_operacional;
$$;

grant execute on function public.orcamentos_backlog_resumo() to authenticated;
