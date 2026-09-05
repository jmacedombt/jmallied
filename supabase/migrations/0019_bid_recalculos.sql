-- Sistema Allied | Grupo J.Macedo
-- Migration: histórico permanente de cada clique em "Recalcular" (BASES > BID)
--
-- Cada clique em "Recalcular" passa a gravar um "lote" (bid_recalculos)
-- com quem/quando e quantas peças foram verificadas/alteradas, e cada
-- linha de bid_historico_valores gerada por esse recálculo é marcada
-- com o id desse lote — permitindo, a qualquer momento depois, reabrir
-- a lista de peças e os valores (o que era e o que passou a ser) daquele
-- recálculo específico a partir da própria tela Base BID.

create table if not exists public.bid_recalculos (
  id uuid primary key default gen_random_uuid(),
  executado_por uuid references public.usuarios (id),
  executado_em timestamptz not null default now(),
  pecas_verificadas integer not null default 0,
  pecas_alteradas integer not null default 0
);

comment on table public.bid_recalculos is
  'Um registro por clique em "Recalcular" na tela Base BID (quem, quando, quantas peças verificadas/alteradas). As peças alteradas naquele recálculo ficam em bid_historico_valores com recalculo_id apontando pra cá.';

create index if not exists bid_recalculos_executado_em_idx on public.bid_recalculos (executado_em desc);

-- liga cada linha de histórico gerada por um recálculo ao lote que a
-- gerou — nulo pra linhas antigas (de antes dessa migration) e pras que
-- vêm de outra origem (importacao_bid, edicao_manual).
alter table public.bid_historico_valores
  add column if not exists recalculo_id uuid references public.bid_recalculos (id) on delete set null;

create index if not exists bid_historico_valores_recalculo_id_idx on public.bid_historico_valores (recalculo_id);

-- RLS: leitura liberada pra autenticados; escrita via rotina de servidor
-- com service role (mesmo padrão das demais tabelas do BID).
alter table public.bid_recalculos enable row level security;

drop policy if exists "bid_recalculos_select_autenticados" on public.bid_recalculos;
create policy "bid_recalculos_select_autenticados"
  on public.bid_recalculos for select to authenticated using (true);
