-- Fase 2: rastreia quando o Custo Peça (Allied) de cada peça do BID
-- mudou de valor pela última vez, e se subiu (+) ou caiu (-). Peça que
-- nunca teve o valor alterado desde que entrou na base usa a data da
-- primeira carga (criado_em) e fica sem direção (null).
alter table public.bid_pecas
  add column if not exists valor_atualizado_em timestamptz,
  add column if not exists valor_direcao text check (valor_direcao in ('+', '-'));

-- backfill: peças já existentes usam a própria data de criação como
-- "primeira carga" (não sabemos se já tiveram alteração antes dessa
-- coluna existir, então tratamos como se estivessem no valor original).
update public.bid_pecas set valor_atualizado_em = criado_em where valor_atualizado_em is null;

alter table public.bid_pecas
  alter column valor_atualizado_em set not null,
  alter column valor_atualizado_em set default now();

comment on column public.bid_pecas.valor_atualizado_em is
  'Quando o Custo Peça (Allied) dessa peça mudou de valor pela última vez. Nunca alterada desde a primeira carga = data dessa carga.';
comment on column public.bid_pecas.valor_direcao is
  '"+" = o valor subiu na última alteração, "-" = caiu. NULL = nunca teve alteração de valor desde a primeira carga.';
