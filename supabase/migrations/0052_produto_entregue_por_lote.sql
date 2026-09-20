-- Sistema Allied | Grupo J.Macedo
-- Migration 0052: Produto Entregue por lote (pedido explícito) — usado
-- tanto no card "Produto Entregue" do Painel Operacional (quantidade de
-- LOTES distintos que já têm alguma entrega, ver
-- src/app/operacional/page.tsx) quanto na própria tela "Produto
-- Entregue", que passou a agrupar por NF Remessa em vez de listar cada
-- aparelho solto (ver PainelProdutoEntregue.tsx e operacional/[slug]/page.tsx).
--
-- Por lote: total_lote = TODOS os orçamentos já importados com essa
-- nf_remessa_allied, em QUALQUER status (não só os numerados) — "quantos
-- entraram no sistema com essa NF, desde sempre"; quantidade_entregue =
-- quantos desses já estão como "Produto Entregue" agora. Só entram
-- lotes que já têm pelo menos 1 entregue (HAVING) — é só isso que as
-- duas telas acima precisam mostrar.
--
-- security definer + grant authenticated: mesmo motivo das outras RPCs
-- de contagem por status (migrations 0035/0045/0051) — não expõe
-- custo/BID nenhum, só nf_remessa_allied e contagens.
create or replace function public.orcamentos_produto_entregue_por_lote()
returns table (
  nf_remessa_allied text,
  total_lote bigint,
  quantidade_entregue bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.nf_remessa_allied,
    count(*) as total_lote,
    count(*) filter (where o.status_operacional = 'Produto Entregue') as quantidade_entregue
  from public.orcamentos o
  where o.nf_remessa_allied is not null
  group by o.nf_remessa_allied
  having count(*) filter (where o.status_operacional = 'Produto Entregue') > 0;
$$;

grant execute on function public.orcamentos_produto_entregue_por_lote() to authenticated;
