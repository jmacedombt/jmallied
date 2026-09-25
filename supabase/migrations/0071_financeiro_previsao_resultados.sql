-- Sistema Allied | Grupo J.Macedo
-- Migration 0071: "Previsão de Resultados" (pedido explícito, 25/09/2026)
-- — resumo financeiro por lote (NF Remessa): quantidade, mão de obra,
-- custo de peças, imposto e venda de peças, só considerando dinheiro já
-- CONFIRMADO pela Allied (aprovado, direto ou via Contra Proposta) — da
-- mesma forma que Métricas > Previsão de Recebimento (migration
-- 0040/0042/0046) já faz. Sem filtro de período: é sempre a "foto atual"
-- de tudo que está em aberto ou já concluído. Usado tanto no novo menu
-- Financeiro > Previsão de Resultados quanto no pop-up de resumo em
-- Métricas > Orçamentos > Por lote (NF Remessa).
--
-- Reprovado (recusado de primeira ou em Contra Proposta) conta na
-- quantidade, mas com R$ 0 em todos os valores — não é dinheiro que vai
-- entrar (pedido explícito). Detectado por motivo_reprova IS NOT NULL,
-- NÃO pelo status_operacional atual: um reprovado continua avançando de
-- status depois de "8 - Orçamento Reprovado" (emissão da NF de devolução
-- -> "Ag. NF Retorno (Recusados)" -> "Produto Entregue", o MESMO status
-- final usado por quem foi aprovado e entregue!) — checar só o status
-- atual classificaria errado um reprovado que já teve a devolução
-- concluída. motivo_reprova é gravado em TODO caminho de reprovação
-- (manual em qualquer etapa, "Confirmar" automático vindo da resposta da
-- Allied, e Contra Proposta recusada — ver
-- api/operacional/orcamentos/[id]/reprovar,
-- confirmar-resultado-aprovacao e enviar-contra-proposta) e nunca é
-- apagado depois, o que o torna um sinal confiável independente de onde
-- o aparelho está agora.
--
-- Valor de cada aparelho aprovado segue a MESMA cascata de prioridade já
-- usada em previsao_recebimento_resumo (migration 0046) — o valor mais
-- recente/negociado disponível:
--   1) reorcamento_detalhe, quando aprovado_reorcamento_em preenchido
--      (peça adicional achada durante o reparo, já aprovada);
--   2) contra_proposta_pecas/contra_proposta_mao_de_obra, quando
--      contra_proposta_ajustado = true (negociação em Ag. Contra
--      Proposta aceita com valor diferente do original);
--   3) senão, validacao_snapshot (valor original congelado em
--      "Confirmar Envio"/Validação de Orçamentos).
create or replace function public.financeiro_previsao_resultados_por_lote()
returns table (
  nf_remessa_allied text,
  quantidade_aprovados bigint,
  quantidade_reprovados bigint,
  mao_de_obra numeric,
  custo_pecas numeric,
  imposto_pecas numeric,
  venda_pecas numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      o.nf_remessa_allied,
      (o.motivo_reprova is not null) as reprovado,
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'maoDeObra', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce(o.contra_proposta_mao_de_obra, 0)
        else coalesce(nullif(o.validacao_snapshot->>'maoDeObra', '')::numeric, 0)
      end as mao_de_obra,
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'custoTotalPecas', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce((
            select sum(coalesce(nullif(p->>'custo', '')::numeric, 0))
            from jsonb_array_elements(o.contra_proposta_pecas) as p
          ), 0)
        else coalesce(nullif(o.validacao_snapshot->>'custoTotalPecas', '')::numeric, 0)
      end as custo_pecas,
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'impostoTotalPecas', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce((
            select sum(coalesce(nullif(p->>'imposto', '')::numeric, 0))
            from jsonb_array_elements(o.contra_proposta_pecas) as p
          ), 0)
        else coalesce(nullif(o.validacao_snapshot->>'impostoTotalPecas', '')::numeric, 0)
      end as imposto_pecas,
      case
        when o.aprovado_reorcamento_em is not null and o.reorcamento_detalhe is not null
          then coalesce(nullif(o.reorcamento_detalhe->>'vendaTotalPecas', '')::numeric, 0)
        when o.contra_proposta_ajustado and o.contra_proposta_pecas is not null
          then coalesce((
            select sum(coalesce(nullif(p->>'vendaNova', '')::numeric, 0))
            from jsonb_array_elements(o.contra_proposta_pecas) as p
          ), 0)
        else coalesce(nullif(o.validacao_snapshot->>'vendaTotalPecas', '')::numeric, 0)
      end as venda_pecas
    from public.orcamentos o
    where o.status_operacional in (
      '5 - Ag. Peças',
      '6 - Ag. Reparo',
      'OQC - Controle de Qualidade',
      '7 - Reparo Finalizado',
      'Ag. NF Serviço / Venda / Retorno',
      'Ag. NF Retorno (Recusados)',
      'Produto Entregue',
      '8 - Orçamento Reprovado'
    )
  )
  select
    nf_remessa_allied,
    count(*) filter (where not reprovado) as quantidade_aprovados,
    count(*) filter (where reprovado) as quantidade_reprovados,
    coalesce(sum(mao_de_obra) filter (where not reprovado), 0) as mao_de_obra,
    coalesce(sum(custo_pecas) filter (where not reprovado), 0) as custo_pecas,
    coalesce(sum(imposto_pecas) filter (where not reprovado), 0) as imposto_pecas,
    coalesce(sum(venda_pecas) filter (where not reprovado), 0) as venda_pecas
  from base
  group by nf_remessa_allied
  order by nf_remessa_allied;
$$;

grant execute on function public.financeiro_previsao_resultados_por_lote() to authenticated;
