-- Sistema Allied | Grupo J.Macedo
-- Migration 0042: previsao_recebimento_resumo passa a aceitar também
-- "OQC - Controle de Qualidade" e "8 - Orçamento Reprovado" — pra
-- alimentar o mesmo card "Mão de Obra | Peças" do topo dessas duas
-- telas (mesmo padrão de 5/6/7, ver 0040/0041). Em OQC ainda é valor
-- aprovado pela Allied (é o que vamos receber assim que sair de lá);
-- em "8 - Orçamento Reprovado" é o valor que tinha sido calculado mas
-- foi recusado — não é dinheiro a receber, só informativo (o texto da
-- pill nessa tela deixa isso claro, ver CardValorPrevisao variante
-- "reprovado").
--
-- Resto do corpo idêntico à 0041 — só o "where" muda.
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
    '8 - Orçamento Reprovado'
  )
    and (p_status is null or o.status_operacional = p_status)
  group by o.status_operacional;
$$;

grant execute on function public.previsao_recebimento_resumo(text) to authenticated;
