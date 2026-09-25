-- Sistema Allied | Grupo J.Macedo
-- Migration 0072: override de multiplicador de Markup por MODELO + Peça
-- (pedido explícito, 25/09/2026) — botão "Aplicar" dentro do novo
-- pop-up "Resumo de Peças por Modelo" em Validação de Orçamentos (ver
-- PopupResumoPecasModelo.tsx). É a mesma ideia do override por lote
-- (migration 0050, "Utilizar nova margem" na tela por Faixa), só que
-- aqui o multiplicador é fixado por combinação específica de Modelo
-- Comercial + código de peça, em vez de por faixa de custo inteira.
--
-- Quando existir um registro aqui pra (modelo_comercial, codigo), ele
-- TEM PRIORIDADE sobre qualquer Faixa de Markup — tanto a global
-- (configuracoes_bid_markup) quanto o override por lote (migration
-- 0050) — por ser mais específico. Vale só pro cálculo de Validação de
-- Orçamentos (tela ao vivo, Recalcular, congelado de Confirmar Envio,
-- reprovação manual e decisão de Contra Proposta) — não mexe no BID
-- (Bases > BID) nem em nenhum outro cálculo de custo/venda de peça fora
-- desse fluxo.
create table if not exists public.orcamentos_modelo_peca_markup_override (
  id uuid primary key default gen_random_uuid(),
  modelo_comercial text not null,
  codigo text not null,
  multiplicador numeric not null,
  definido_por uuid references public.usuarios (id),
  definido_em timestamptz not null default now(),
  unique (modelo_comercial, codigo)
);

create index if not exists orcamentos_modelo_peca_markup_override_modelo_idx
  on public.orcamentos_modelo_peca_markup_override (modelo_comercial);

comment on table public.orcamentos_modelo_peca_markup_override is 'Override de multiplicador de Markup por Modelo Comercial + código de peça — botão "Aplicar" no pop-up Resumo de Peças por Modelo, em Validação de Orçamentos. Um registro por (modelo_comercial, codigo); existindo, substitui a Faixa de Markup (global ou por lote) só pra essa combinação, no cálculo de Validação de Orçamentos.';
comment on column public.orcamentos_modelo_peca_markup_override.multiplicador is 'Multiplicador simulado confirmado pra essa peça dentro desse modelo — mesma cascata de cálculo do BID (teto(custo x multiplicador, 2) + ICMS).';

alter table public.orcamentos_modelo_peca_markup_override enable row level security;
create policy "orcamentos_modelo_peca_markup_override_select_autenticados" on public.orcamentos_modelo_peca_markup_override for select to authenticated using (true);
