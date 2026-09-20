-- Sistema Allied | Grupo J.Macedo
-- Migration 0050: override de Faixas de Markup por LOTE (NF Remessa),
-- usado pelo botão "Utilizar nova margem" dentro do pop-up "Resumo de
-- Peças" em Validação de Orçamentos (ver PopupResumoPecasMarkup.tsx) —
-- pedido explícito.
--
-- Quando esse pop-up está aberto com um lote específico selecionado, é
-- possível simular um "Mult. Simulado" diferente pra cada faixa de
-- Markup (Configurações > Faixas de Markup) e, ao confirmar, gravar essa
-- combinação de multiplicadores AQUI, vinculada só àquele nf_remessa_allied.
-- Isso vale só pra esse lote, PERMANENTEMENTE (até alguém apagar o
-- registro) — se outro lote for selecionado depois, ele continua usando
-- a faixa global normal (configuracoes_bid_markup), a não ser que também
-- tenha seu próprio override gravado aqui.
--
-- A tabela guarda um snapshot completo das faixas daquele momento (`faixas`
-- jsonb, mesmo formato de FaixaMarkup[]: [{ valor_min, valor_max,
-- multiplicador }]) — mesmos limites (valor_min/valor_max) da
-- configuração global no momento em que o botão foi usado, só com o
-- multiplicador trocado pelo simulado. Isso é consumido em TODO lugar que
-- calcula o detalhe de peças desse lote em Validação de Orçamentos
-- (calcularDetalheValidacao): a tela ao vivo (operacional/[slug]/page.tsx),
-- inclusive depois de clicar "Recalcular", e o cálculo congelado no
-- momento de "Confirmar Envio" (lib/validacaoEnvioAllied.ts) — em vez das
-- faixas de configuracoes_bid_markup, quando existir override pra aquele
-- nf_remessa_allied.
create table if not exists public.orcamentos_lote_markup_override (
  id uuid primary key default gen_random_uuid(),
  nf_remessa_allied text not null unique,
  faixas jsonb not null,
  definido_por uuid references public.usuarios (id),
  definido_em timestamptz not null default now()
);

create index if not exists orcamentos_lote_markup_override_nf_idx on public.orcamentos_lote_markup_override (nf_remessa_allied);

comment on table public.orcamentos_lote_markup_override is 'Override de Faixas de Markup (multiplicador) por lote (NF Remessa) — botão "Utilizar nova margem" no pop-up Resumo de Peças de Validação de Orçamentos. Um registro por nf_remessa_allied; existindo, substitui configuracoes_bid_markup só pros orçamentos daquele lote em Validação de Orçamentos (ao vivo e no cálculo congelado de Confirmar Envio).';
comment on column public.orcamentos_lote_markup_override.faixas is 'Snapshot de FaixaMarkup[]: [{ valor_min, valor_max, multiplicador }] — mesmos limites da configuração global no momento, com o multiplicador de cada faixa trocado pelo "Mult. Simulado" confirmado.';

alter table public.orcamentos_lote_markup_override enable row level security;
create policy "orcamentos_lote_markup_override_select_autenticados" on public.orcamentos_lote_markup_override for select to authenticated using (true);
