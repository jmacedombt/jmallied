-- Sistema Allied | Grupo J.Macedo
-- Migration 0063: função pro card de destaque "Valor total em aberto" do
-- painel Operacional (pedido explícito) — soma o valor_total_reparo (valor
-- gravado na importação de cada ordem de serviço, existe pra TODAS,
-- independente da etapa) de tudo que ainda está no pipeline, ou seja,
-- TODOS os status_operacional MENOS "Produto Entregue" (último card),
-- que só acumula pra sempre e não representa "o que ainda está em
-- aberto no sistema".

create or replace function public.orcamentos_valor_total_ativo()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(valor_total_reparo), 0)
  from public.orcamentos
  where status_operacional <> 'Produto Entregue';
$$;

grant execute on function public.orcamentos_valor_total_ativo() to authenticated;
