-- Sistema Allied | Grupo J.Macedo
-- Migration 0046: previsao_recebimento_resumo passa a aceitar também
-- "Ag. NF Serviço / Venda / Retorno" — o status REAL (ver
-- STATUS_AG_NF_SERVICO_VENDA_RETORNO em lib/orcamentos.ts) usado quando
-- o aparelho está parado na etapa/tela "Ag. Emissão de Nota Fiscal" após
-- ter vindo de "7 - Reparo Finalizado" (ou seja, aprovado — dinheiro que
-- ainda vamos receber). O card agregado "Total previsto a receber" do
-- menu Métricas > Previsão de Recebimento passou a somar 5, 6, OQC, 7 e
-- essa etapa (pedido explícito) — sem incluir "8 - Orçamento Reprovado"
-- nem "Ag. NF Retorno (Recusados)" (a metade recusada da mesma tela),
-- porque esse valor não é dinheiro a receber, só informativo (mesma
-- lógica já documentada na migration 0042).
--
-- "Ag. NF Retorno (Recusados)" continua de fora do "in (...)" abaixo de
-- propósito — não faz sentido nenhuma tela somar esse valor como "a
-- receber".
--
-- Resto do corpo idêntico à 0042 — só o "where" muda.
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
  where o.status_operacional in (
    '5 - Ag. Peças',
    '6 - Ag. Reparo',
    'OQC - Controle de Qualidade',
    '7 - Reparo Finalizado',
    '8 - Orçamento Reprovado',
    'Ag. NF Serviço / Venda / Retorno'
  )
    and (p_status is null or o.status_operacional = p_status)
  group by o.status_operacional;
$$;

grant execute on function public.previsao_recebimento_resumo(text) to authenticated;
