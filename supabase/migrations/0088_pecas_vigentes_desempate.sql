-- Sistema Allied | Grupo J.Macedo
-- Migration 0088: pecas_vigentes com desempate fixo (17/11/2026).
-- Quando o mesmo código tem 2+ compras na mesma data importadas juntas
-- (mesmo created_at, comum na importação automática diária), a view
-- escolhia uma delas "ao acaso" — cada consulta podia trazer um valor
-- diferente (ex.: GH82-32860A R$ 139,27 x R$ 139,28), e o Recalcular BID
-- e a Validação de Orçamentos discordavam entre si. Agora, no empate,
-- vale o MAIOR valor unitário (nunca cobra abaixo do custo) e, por
-- último, o id, então o resultado é sempre o mesmo.
create or replace view public.pecas_vigentes as
select distinct on (codigo)
  codigo,
  descricao,
  data_compra,
  quantidade,
  valor_total,
  round(valor_total / quantidade, 2) as valor_unitario,
  delivery
from public.pecas_compras
order by codigo, data_compra desc, created_at desc, round(valor_total / quantidade, 2) desc, id desc;

comment on view public.pecas_vigentes is
  'Preço/última compra vigente de cada código de peça (compra mais recente; empate na mesma data/importação = maior valor unitário, depois id).';
