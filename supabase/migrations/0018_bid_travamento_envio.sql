-- Consistência BID <-> Validação de Orçamentos: trava e reconciliação
-- de valores depois que já foram informados ao cliente.
--
-- Duas travas independentes:
--
-- 1) BID (Bases > BID > Relatório BID): "Marcar como enviado" grava,
--    peça a peça, o valor de Custo Peça (Allied) que foi informado ao
--    cliente naquele momento (valor_enviado_cliente/em/por). É uma ação
--    explícita, separada do "Gerar relatório" — que continua podendo ser
--    rodado livremente como rascunho sem travar nada. A partir do envio,
--    qualquer Recalcular BID que mudaria o valor de uma peça já enviada
--    exige confirmação explícita (ver bid_reconciliacoes) antes de
--    aplicar a mudança.
--
-- 2) Validação de Orçamentos: ao confirmar o envio de um lote (botão
--    "Confirmar Envio", já existente), o orçamento é travado
--    (validacao_travado) e um retrato completo do cálculo daquele
--    momento fica gravado em validacao_snapshot — pra qualquer mudança
--    futura na Base Peças, markup ou ICMS não alterar retroativamente o
--    valor que já foi informado ao cliente nesse orçamento.

alter table public.bid_pecas
  add column if not exists valor_enviado_cliente numeric,
  add column if not exists valor_enviado_em timestamptz,
  add column if not exists valor_enviado_por uuid references public.usuarios (id);

comment on column public.bid_pecas.valor_enviado_cliente is
  'Custo Peça (Allied) travado no momento do "Marcar BID como enviado" — o valor que foi de fato informado ao cliente. Null enquanto a peça nunca foi marcada como enviada.';
comment on column public.bid_pecas.valor_enviado_em is
  'Data/hora do último "Marcar BID como enviado" que incluiu essa peça.';

-- histórico de reconciliação: toda vez que um Recalcular BID mudaria o
-- valor de uma peça já enviada ao cliente, fica registrado aqui quem
-- confirmou que era realmente pra mandar um valor diferente do enviado
-- inicialmente.
create table if not exists public.bid_reconciliacoes (
  id uuid primary key default gen_random_uuid(),
  bid_peca_id uuid references public.bid_pecas (id),
  part_number text not null,
  valor_enviado_cliente numeric,
  valor_anterior numeric,
  valor_novo numeric,
  origem text not null default 'recalculo',
  confirmado_por uuid references public.usuarios (id),
  confirmado_em timestamptz not null default now()
);

comment on table public.bid_reconciliacoes is
  'Log de confirmações: toda vez que um valor de peça já enviado ao cliente (bid_pecas.valor_enviado_cliente) mudou por causa de um recálculo, fica registrado aqui quem confirmou a divergência.';

create index if not exists bid_reconciliacoes_bid_peca_id_idx on public.bid_reconciliacoes (bid_peca_id);

alter table public.bid_reconciliacoes enable row level security;

drop policy if exists "bid_reconciliacoes_select_autenticados" on public.bid_reconciliacoes;
create policy "bid_reconciliacoes_select_autenticados"
  on public.bid_reconciliacoes for select to authenticated using (true);

-- trava do orçamento na Validação: preenchida no mesmo momento do
-- "Confirmar Envio" (avancar-validacao-em-massa) que já existe — não é
-- uma ação nova pro usuário, só passa a gravar o retrato do cálculo.
alter table public.orcamentos
  add column if not exists validacao_travado boolean not null default false,
  add column if not exists validacao_travado_em timestamptz,
  add column if not exists validacao_travado_por uuid references public.usuarios (id),
  add column if not exists validacao_snapshot jsonb;

comment on column public.orcamentos.validacao_travado is
  'true depois que o lote foi confirmado (Confirmar Envio) — o cálculo de peças desse orçamento fica congelado em validacao_snapshot, mudanças futuras na Base Peças/markup/ICMS não alteram mais o valor já informado ao cliente.';
comment on column public.orcamentos.validacao_snapshot is
  'Retrato completo (JSON) do cálculo de Validação de Orçamentos no momento do travamento: peças (código, custo, imposto, venda), totais e mão de obra — mesmo formato de DetalheValidacaoOrcamento.';
