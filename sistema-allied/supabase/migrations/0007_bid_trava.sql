-- Sistema Allied | Grupo J.Macedo
-- Migration: trava (lock) de peças do BID + edição manual de preço
--
-- Consulta BID passa a permitir editar manualmente o Custo Peça
-- (Allied) de uma peça e travar o valor, pra que uma reimportação do
-- BID ou um "Recalcular" não sobrescrevam o preço definido na mão.

alter table public.bid_pecas
  add column if not exists travado boolean not null default false,
  add column if not exists travado_por uuid references public.usuarios (id),
  add column if not exists travado_em timestamptz;

comment on column public.bid_pecas.travado is
  'Quando true, importação do BID e "Recalcular" não sobrescrevem custo_peca_samsung/valor_com_margem/custo_peca_allied dessa peça — o preço foi definido manualmente na Consulta BID.';

create index if not exists bid_pecas_travado_idx on public.bid_pecas (id) where travado;

-- passa a aceitar 'edicao_manual' como origem de uma mudança de valor
-- (além de 'importacao_bid' e 'recalculo', já existentes)
alter table public.bid_historico_valores
  drop constraint if exists bid_historico_valores_origem_check;

alter table public.bid_historico_valores
  add constraint bid_historico_valores_origem_check
  check (origem in ('importacao_bid', 'recalculo', 'edicao_manual'));
