-- Sistema Allied | Grupo J.Macedo
-- Migration 0041: corrige previsao_recebimento_resumo (0040) — o filtro
-- comparava status_operacional com o SLUG da URL ('5-ag-pecas',
-- '6-ag-reparo', '7-reparo-finalizado'), mas o valor real gravado na
-- coluna é o texto por extenso usado em todo o resto do sistema
-- (STATUS_OPERACIONAL em lib/orcamentos.ts): '5 - Ag. Peças',
-- '6 - Ag. Reparo', '7 - Reparo Finalizado'. Por isso a função sempre
-- devolvia 0 linhas, mesmo com aparelhos de verdade parados nessas
-- etapas (confirmado via
-- select status_operacional, count(*) from orcamentos group by 1).
--
-- Mesmo corpo da 0040, só com o "where" corrigido.
create or replace function public.previsao_recebimento_resumo(p_status text default null)
returns table (
  status_operacional text,
  mao_de_obra numeric,
  venda_pecas numeric,
  quantidade bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.status_operacional,
    coalesce(sum(
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'maoDeObra', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce(o.contra_proposta_mao_de_obra, 0)
        else coalesce(nullif(o.validacao_snapshot->>'maoDeObra', '')::numeric, 0)
      end
    ), 0) as mao_de_obra,
    coalesce(sum(
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'vendaTotalPecas', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce((
            select sum(coalesce(nullif(p->>'vendaNova', '')::numeric, 0))
            from jsonb_array_elements(o.contra_proposta_pecas) as p
          ), 0)
        else coalesce(nullif(o.validacao_snapshot->>'vendaTotalPecas', '')::numeric, 0)
      end
    ), 0) as venda_pecas,
    count(*) as quantidade
  from public.orcamentos o
  where o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado')
    and (p_status is null or o.status_operacional = p_status)
  group by o.status_operacional;
$$;

grant execute on function public.previsao_recebimento_resumo(text) to authenticated;
