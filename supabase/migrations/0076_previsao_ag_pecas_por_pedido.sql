-- Sistema Allied | Grupo J.Macedo
-- Migration 0076: card "Mão de Obra | Peças" separado nas 2 telas de
-- Ag. Peças (pedido explícito, 08/10/2026):
--   "5 - Ag. Peças"              → aparelhos SEM pedido de peça feito
--   "Ag. Peças - (Recebimento)"  → aparelhos COM pedido feito, aguardando a peça chegar
-- No banco os dois continuam em status_operacional = '5 - Ag. Peças' — a
-- diferença é só o campo pedido_peca_feito. Mesma conta de
-- previsao_recebimento_resumo (migration 0046), só filtrando por esse campo.
-- Não altera nenhuma função existente.

create or replace function public.previsao_recebimento_ag_pecas(p_pedido_feito boolean)
returns table (
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
  where o.status_operacional = '5 - Ag. Peças'
    and o.pedido_peca_feito = p_pedido_feito;
$$;

grant execute on function public.previsao_recebimento_ag_pecas(boolean) to authenticated;
