-- Fase 1 do ajuste de cálculo do BID: agora o Custo Peça (Allied) passa
-- a incluir o ICMS configurado (Configurações > Imposto), e o
-- arredondamento final vira sempre número inteiro pra cima (ex: 43,35
-- -> 44,00), não mais só 2 casas decimais como estava antes.
--
-- valor_com_margem continua sendo só "Custo Samsung x markup da faixa"
-- (sem imposto) — é o valor intermediário. custo_peca_allied agora é
-- "valor_com_margem + imposto sobre valor_com_margem", arredondado pra
-- cima pro inteiro — deixa de ser um espelho de valor_com_margem.
alter table public.bid_pecas
  add column if not exists valor_imposto numeric(12, 2);

comment on column public.bid_pecas.valor_imposto is
  'Parcela de ICMS (em R$) embutida no Custo Peça (Allied) — valor_com_margem × icms_percentual. NULL em peça pendente (sem custo) ou com valor editado manualmente.';

-- o histórico de variação de valor guardava só custo_peca_samsung e
-- valor_com_margem (que até aqui eram suficientes, já que
-- custo_peca_allied era sempre igual a valor_com_margem). Agora que
-- custo_peca_allied inclui o imposto e pode divergir, passa a guardar
-- o histórico dele também.
alter table public.bid_historico_valores
  add column if not exists custo_peca_allied_anterior numeric(12, 2),
  add column if not exists custo_peca_allied_novo numeric(12, 2),
  add column if not exists valor_imposto_anterior numeric(12, 2),
  add column if not exists valor_imposto_novo numeric(12, 2);
