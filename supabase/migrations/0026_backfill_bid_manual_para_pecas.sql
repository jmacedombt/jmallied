-- Sistema Allied | Grupo J.Macedo
-- Script de correção pontual (não altera nenhuma tabela/coluna) — não é
-- uma migration de estrutura, é só um ajuste de dados. Roda uma vez só.
--
-- Contexto: até agora, cadastrar uma peça manualmente no BID (popup
-- aberto em "2 - Ag. Análise" quando uma peça não tem custo no BID)
-- gravava o valor só em bid_pecas — nunca chegava até a Base Peças
-- (pecas_compras/pecas_vigentes), que é o que a tela "Validação de
-- Orçamentos" consulta. Resultado: a peça aparecia certinha, travada, no
-- BID, mas continuava "Sem custo" em Validação (foi o caso da peça
-- GH98-50024A). Isso já foi corrigido no código pra cadastros novos — os
-- dois cadastros manuais (BID e Base Peças) agora se atualizam um ao
-- outro na hora. Esse script aqui é só pra "acertar" quem já tinha sido
-- cadastrado manualmente no BID ANTES dessa correção existir.
--
-- O que faz: pra cada Part Number do BID marcado como cadastrado
-- manualmente (cadastrado_manualmente = true) que ainda não tem NENHUMA
-- compra vigente na Base Peças, grava o custo_peca_samsung dessa peça
-- como uma "compra" de hoje em pecas_compras — exatamente o mesmo que
-- teria acontecido se o cadastro manual do BID já tivesse essa ponte
-- desde o início.
--
-- Seguro de rodar mais de uma vez (idempotente): depois da primeira
-- execução, o "not exists" abaixo já encontra a compra recém-criada e
-- não insere de novo. Nunca sobrescreve nem duplica um custo que já
-- exista na Base Peças pra esse código — só preenche quem estava
-- realmente faltando.
--
-- Quando o mesmo Part Number tem mais de uma peça cadastrada
-- manualmente no BID (em modelos diferentes), usa o valor da alteração
-- mais recente (valor_atualizado_em) como referência.
insert into public.pecas_compras (codigo, descricao, data_compra, quantidade, valor_total, delivery)
select distinct on (bp.part_number)
  bp.part_number,
  (
    select bs.peca_solucao
    from public.bid_solucoes bs
    where bs.bid_peca_id = bp.id
    order by bs.principal desc
    limit 1
  ) as descricao,
  current_date,
  1,
  bp.custo_peca_samsung,
  'CADASTRO MANUAL (BID) - BACKFILL'
from public.bid_pecas bp
where bp.cadastrado_manualmente = true
  and bp.custo_peca_samsung is not null
  and bp.custo_peca_samsung > 0
  and not exists (
    select 1 from public.pecas_vigentes pv where pv.codigo = bp.part_number
  )
order by bp.part_number, bp.valor_atualizado_em desc
on conflict do nothing;
