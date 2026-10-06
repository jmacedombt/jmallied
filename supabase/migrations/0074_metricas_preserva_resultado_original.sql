-- Sistema Allied | Grupo J.Macedo
-- Migration 0074: Métricas > Orçamentos passa a classificar pela
-- PRIMEIRA decisão que o orçamento já tomou (entrou em "5 - Ag. Peças"
-- ou em "8 - Orçamento Reprovado"), não mais pelo status_operacional
-- ATUAL (pedido explícito, 06/10/2026 — "os reprovados/contra proposta
-- recusada de lotes antigos sumiram da tela 'Por lote'").
--
-- Causa raiz: a ferramenta "Movimentar" (menu Operacional, migration
-- 0073) troca o status_operacional em lote pulando todas as regras
-- normais — inclusive dá pra mover um orçamento de "8 - Orçamento
-- Reprovado" direto pra "Produto Entregue", sem nunca passar por "5 -
-- Ag. Peças". metricas_resultado_orcamentos/metricas_resultado_pecas
-- (migration 0029/0045/0062) classificavam pelo status_operacional
-- ATUAL: um orçamento movido assim deixava de contar como reprovado — e
-- como a data de fechamento (fechado_em) só era calculada a partir da
-- primeira entrada em "5 - Ag. Peças" (que nesse caso nunca existiu),
-- ele ficava com fechado_em nulo e desaparecia da conta inteira (nem
-- aprovado, nem reprovado — some do Total também, por isso o % de
-- aprovação fecha em 100% olhando só quem sobrou).
--
-- Decisão de negócio (pedido explícito, 06/10/2026): um orçamento que já
-- foi reprovado continua contando como reprovado/contra-proposta-
-- recusada na métrica, mesmo que o Movimentar tenha forçado ele depois
-- pra "Produto Entregue" (ou qualquer outro status) — o resultado
-- "oficial" é a primeira decisão real que ele teve, não o status atual.
--
-- Como fica (sem coluna nova, sem tabela nova — continua tudo calculado
-- na hora a partir de orcamento_status_historico, mesmo princípio já
-- documentado em 0062):
--   - Pra cada orçamento, acha a primeira vez que ele entrou em "5 - Ag.
--     Peças" (primeira_entrada_aprovado) e a primeira vez que entrou em
--     "8 - Orçamento Reprovado" (primeira_entrada_reprovado).
--   - "decisão foi reprovar" = teve uma entrada em "8" E (nunca entrou
--     em "5" OU a entrada em "8" aconteceu ANTES da entrada em "5") —
--     ou seja, o que aconteceu primeiro na vida real do orçamento.
--   - fechado_em do ramo reprovado continua pegando a ÚLTIMA entrada em
--     "8" (mesmo critério de antes, protege contra reprovação dupla).
--   - fechado_em do ramo aprovado: usa a primeira entrada em "5" quando
--     existir; se não existir (ex: Movimentar pulou direto pra "Produto
--     Entregue" sem nunca ter passado por "5" nem por "8" — não é o caso
--     relatado, mas evita reabrir o mesmo buraco pro lado aprovado),
--     cai pra data em que entrou no status atual — nunca mais fica nulo
--     só por causa disso.
--   - "passou por contra proposta" continua igual (migration 0062):
--     histórico com "4 - Ag. Resposta de Reorçamento" OU
--     contra_proposta_decisao preenchida.
--
-- Esse recálculo vale pra TODO o histórico assim que a função é
-- trocada (ela é stable, sem cache/materialização — mesma observação já
-- feita em 0062) — não precisa (e não tem como) "consertar" nenhuma
-- linha gravada errada, porque nenhum resultado fica gravado em lugar
-- nenhum.

create or replace function public.metricas_resultado_orcamentos(
  p_inicio date,
  p_fim date
)
returns table (
  orcamento_id uuid,
  nf_remessa_allied text,
  modelo_comercial text,
  resultado text,
  fechado_em timestamptz,
  venda_total_pecas numeric,
  mao_de_obra numeric,
  valor_total_reparo numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with historico_decisivo as (
    select
      h.orcamento_id,
      min(h.mudou_em) filter (where h.status_novo = '5 - Ag. Peças') as primeira_entrada_aprovado,
      min(h.mudou_em) filter (where h.status_novo = '8 - Orçamento Reprovado') as primeira_entrada_reprovado,
      max(h.mudou_em) filter (where h.status_novo = '8 - Orçamento Reprovado') as ultima_entrada_reprovado
    from public.orcamento_status_historico h
    group by h.orcamento_id
  ),
  fechamento as (
    select
      o.id,
      o.nf_remessa_allied,
      o.modelo_comercial,
      o.status_operacional,
      o.validacao_snapshot,
      (
        exists (
          select 1 from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '4 - Ag. Resposta de Reorçamento'
        )
        or o.contra_proposta_decisao is not null
      ) as passou_contra_proposta,
      (
        hd.primeira_entrada_reprovado is not null
        and (hd.primeira_entrada_aprovado is null or hd.primeira_entrada_reprovado < hd.primeira_entrada_aprovado)
      ) as decisao_foi_reprovar,
      hd.primeira_entrada_aprovado,
      hd.ultima_entrada_reprovado,
      -- fallback só usado quando a decisão foi "aprovar" mas nunca
      -- houve registro de entrada em "5 - Ag. Peças" (Movimentar pulou
      -- direto pra um status fechado sem passar nem por "5" nem por
      -- "8") — pega quando entrou no status atual, pra não ficar nulo.
      (
        select h.mudou_em from public.orcamento_status_historico h
        where h.orcamento_id = o.id and h.status_novo = o.status_operacional
        order by h.mudou_em desc limit 1
      ) as entrada_status_atual
    from public.orcamentos o
    left join historico_decisivo hd on hd.orcamento_id = o.id
    where o.status_operacional = '8 - Orçamento Reprovado'
       or o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado', 'Produto Entregue')
  )
  select
    f.id as orcamento_id,
    f.nf_remessa_allied,
    f.modelo_comercial,
    case
      when f.decisao_foi_reprovar and not f.passou_contra_proposta then 'reprovado_primeira'
      when f.decisao_foi_reprovar and f.passou_contra_proposta then 'contra_proposta_recusada'
      when not f.decisao_foi_reprovar and not f.passou_contra_proposta then 'aprovado_primeira'
      else 'contra_proposta_aceita'
    end as resultado,
    case
      when f.decisao_foi_reprovar then f.ultima_entrada_reprovado
      else coalesce(f.primeira_entrada_aprovado, f.entrada_status_atual)
    end as fechado_em,
    nullif(f.validacao_snapshot->>'vendaTotalPecas', '')::numeric as venda_total_pecas,
    nullif(f.validacao_snapshot->>'maoDeObra', '')::numeric as mao_de_obra,
    case when f.validacao_snapshot is not null then
      coalesce((f.validacao_snapshot->>'vendaTotalPecas')::numeric, 0) + coalesce((f.validacao_snapshot->>'maoDeObra')::numeric, 0)
    else null end as valor_total_reparo
  from fechamento f
  where (case when f.decisao_foi_reprovar then f.ultima_entrada_reprovado else coalesce(f.primeira_entrada_aprovado, f.entrada_status_atual) end) is not null
    and (case when f.decisao_foi_reprovar then f.ultima_entrada_reprovado else coalesce(f.primeira_entrada_aprovado, f.entrada_status_atual) end) >= p_inicio::timestamptz
    and (case when f.decisao_foi_reprovar then f.ultima_entrada_reprovado else coalesce(f.primeira_entrada_aprovado, f.entrada_status_atual) end) < (p_fim + 1)::timestamptz;
$$;

grant execute on function public.metricas_resultado_orcamentos(date, date) to authenticated;

create or replace function public.metricas_resultado_pecas(
  p_inicio date,
  p_fim date
)
returns table (
  part_number text,
  resultado text,
  quantidade bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with historico_decisivo as (
    select
      h.orcamento_id,
      min(h.mudou_em) filter (where h.status_novo = '5 - Ag. Peças') as primeira_entrada_aprovado,
      min(h.mudou_em) filter (where h.status_novo = '8 - Orçamento Reprovado') as primeira_entrada_reprovado,
      max(h.mudou_em) filter (where h.status_novo = '8 - Orçamento Reprovado') as ultima_entrada_reprovado
    from public.orcamento_status_historico h
    group by h.orcamento_id
  ),
  fechamento as (
    select
      o.id,
      o.status_operacional,
      o.peca_1, o.peca_2, o.peca_3, o.peca_4, o.peca_5,
      o.peca_6, o.peca_7, o.peca_8, o.peca_9, o.peca_10,
      o.peca_add_1, o.peca_add_2, o.peca_add_3, o.peca_add_4, o.peca_add_5,
      (
        exists (
          select 1 from public.orcamento_status_historico h
          where h.orcamento_id = o.id and h.status_novo = '4 - Ag. Resposta de Reorçamento'
        )
        or o.contra_proposta_decisao is not null
      ) as passou_contra_proposta,
      (
        hd.primeira_entrada_reprovado is not null
        and (hd.primeira_entrada_aprovado is null or hd.primeira_entrada_reprovado < hd.primeira_entrada_aprovado)
      ) as decisao_foi_reprovar,
      hd.primeira_entrada_aprovado,
      hd.ultima_entrada_reprovado,
      (
        select h.mudou_em from public.orcamento_status_historico h
        where h.orcamento_id = o.id and h.status_novo = o.status_operacional
        order by h.mudou_em desc limit 1
      ) as entrada_status_atual
    from public.orcamentos o
    left join historico_decisivo hd on hd.orcamento_id = o.id
    where o.status_operacional = '8 - Orçamento Reprovado'
       or o.status_operacional in ('5 - Ag. Peças', '6 - Ag. Reparo', '7 - Reparo Finalizado', 'Produto Entregue')
  ),
  classificado as (
    select
      f.*,
      case
        when f.decisao_foi_reprovar and not f.passou_contra_proposta then 'reprovado_primeira'
        when f.decisao_foi_reprovar and f.passou_contra_proposta then 'contra_proposta_recusada'
        when not f.decisao_foi_reprovar and not f.passou_contra_proposta then 'aprovado_primeira'
        else 'contra_proposta_aceita'
      end as resultado,
      case
        when f.decisao_foi_reprovar then f.ultima_entrada_reprovado
        else coalesce(f.primeira_entrada_aprovado, f.entrada_status_atual)
      end as fechado_em_calc
    from fechamento f
  ),
  filtrado as (
    select * from classificado
    where fechado_em_calc is not null
      and fechado_em_calc >= p_inicio::timestamptz
      and fechado_em_calc < (p_fim + 1)::timestamptz
  ),
  pecas as (
    select resultado, unnest(array[
      peca_1, peca_2, peca_3, peca_4, peca_5,
      peca_6, peca_7, peca_8, peca_9, peca_10,
      peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5
    ]) as part_number
    from filtrado
  )
  select part_number, resultado, count(*) as quantidade
  from pecas
  where part_number is not null and btrim(part_number) <> ''
  group by part_number, resultado
  order by part_number, resultado;
$$;

grant execute on function public.metricas_resultado_pecas(date, date) to authenticated;
