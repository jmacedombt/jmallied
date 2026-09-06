-- Sistema Allied | Grupo J.Macedo
-- Migration: variação de preço recente da Base Peças
--
-- Lista, pra cada código, a mudança de valor unitário mais recente —
-- comparando a compra vigente (a mesma usada em pecas_vigentes) com a
-- compra imediatamente anterior daquele código (não a primeira compra
-- já feita, e sim a que veio logo antes cronologicamente). Só entra na
-- lista quem teve o valor unitário realmente diferente e cuja compra
-- vigente aconteceu dentro da janela de dias pedida (padrão 60).

create or replace function public.pecas_variacao_preco_recente(p_dias integer default 60)
returns table (
  codigo text,
  descricao text,
  data_anterior date,
  valor_unitario_anterior numeric,
  data_atual date,
  valor_unitario_atual numeric,
  variacao_percentual numeric
)
language sql
stable
as $$
  with compras as (
    select
      codigo,
      descricao,
      data_compra,
      round(valor_total / quantidade, 2) as valor_unitario,
      -- posição 1 = compra vigente do código, mesmo desempate de pecas_vigentes
      row_number() over (partition by codigo order by data_compra desc, created_at desc) as posicao_atual,
      -- valor/data da compra imediatamente anterior (cronologicamente) do mesmo código
      lag(round(valor_total / quantidade, 2)) over (partition by codigo order by data_compra asc, created_at asc) as valor_unitario_anterior,
      lag(data_compra) over (partition by codigo order by data_compra asc, created_at asc) as data_compra_anterior
    from public.pecas_compras
  )
  select
    codigo,
    descricao,
    data_compra_anterior as data_anterior,
    valor_unitario_anterior,
    data_compra as data_atual,
    valor_unitario as valor_unitario_atual,
    round(((valor_unitario - valor_unitario_anterior) / valor_unitario_anterior) * 100, 2) as variacao_percentual
  from compras
  where posicao_atual = 1
    and valor_unitario_anterior is not null
    and valor_unitario_anterior <> valor_unitario
    and data_compra >= (current_date - p_dias)
  order by data_compra desc;
$$;
