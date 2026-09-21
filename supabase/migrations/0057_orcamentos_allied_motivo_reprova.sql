-- Sistema Allied | Grupo J.Macedo
-- Migration 0057: motivo da reprovação também pro login ALLIED.
--
-- Pedido explícito: em "8 - Orçamento Reprovado", o motivo da reprovação
-- (com destaque) já aparece pro login interno desde a migration 0056
-- (PopupPecasOrcamento.tsx). Só que o login ALLIED nunca passa por esse
-- componente: ele tem seu próprio caminho inteiro (RPC
-- orcamentos_allied_listar + PainelOperacionalAllied.tsx +
-- PopupAtendimentoPecasAllied.tsx, ver migration 0035), que simplesmente
-- nunca trazia motivo_reprova/reprovado_em/reprovado_por — não é um bug
-- de tela, o dado nem chegava até o front.
--
-- Postgres não deixa mudar as colunas de retorno de uma function com
-- "create or replace" — por isso precisa dropar antes de recriar.
drop function if exists public.orcamentos_allied_listar(text);

create function public.orcamentos_allied_listar(p_status text default null)
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
  pecas jsonb,
  motivo_reprova text,
  reprovado_em timestamptz,
  reprovado_por_nome text
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
    ) as pecas,
    o.motivo_reprova,
    o.reprovado_em,
    nullif(trim(concat(u.nome, ' ', coalesce(u.sobrenome, ''))), '') as reprovado_por_nome
  from public.orcamentos o
  left join public.usuarios u on u.id = o.reprovado_por
  where p_status is null or o.status_operacional = p_status;
$$;

grant execute on function public.orcamentos_allied_listar(text) to authenticated;
