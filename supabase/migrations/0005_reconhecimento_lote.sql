-- Sistema Allied | Grupo J.Macedo
-- Migration: menu OPERACIONAL > Reconhecimento Lote
--
-- "Data Reconhecimento" = data em que os aparelhos de um lote (uma NF
-- Remessa já importada) chegaram fisicamente na loja. É definida uma
-- única vez por lote inteiro (não por aparelho) e depois acompanha cada
-- aparelho daquele lote durante todo o fluxo operacional — por isso ela
-- mora nas duas tabelas: o registro "oficial" fica em
-- orcamentos_lotes, e uma cópia é replicada pra cada linha de
-- orcamentos daquele lote, pra aparecer direto nas telas de status sem
-- precisar cruzar tabelas.

alter table public.orcamentos_lotes
  add column if not exists data_reconhecimento date,
  add column if not exists reconhecimento_definido_por uuid references public.usuarios (id),
  add column if not exists reconhecimento_definido_em timestamptz;

comment on column public.orcamentos_lotes.data_reconhecimento is
  'Data em que os aparelhos desse lote chegaram na loja. Definida uma vez por lote em Operacional > Reconhecimento Lote.';

alter table public.orcamentos
  add column if not exists data_reconhecimento date;

comment on column public.orcamentos.data_reconhecimento is
  'Cópia da orcamentos_lotes.data_reconhecimento do lote desse aparelho — replicada aqui pra aparecer nas telas de status sem join.';

create index if not exists orcamentos_lote_id_idx on public.orcamentos (lote_id);
