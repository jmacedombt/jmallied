-- Sistema Allied | Grupo J.Macedo
-- Migration 0079: Base de Orçamentos sem Pré-Ordem (pedido explícito,
-- 27/10/2026). Dá pra dar entrada numa NF Remessa só com a Base de
-- Orçamentos; a NF fica marcada "Pré-Ordem pendente" no histórico e,
-- quando o arquivo de Pré-Ordem chegar, ele é subido pelo botão "Subir
-- Pré-Ordem" na linha da NF — casa por sequência com o arquivo de
-- orçamentos guardado dessa NF (mesma regra de sempre: quantidade, lote e
-- SKU linha a linha) e preenche a Pré-Ordem de todos os aparelhos da NF,
-- em qualquer etapa. Ver api/bases/orcamentos/pre-ordem/route.ts.

alter table public.orcamentos_lotes
  add column if not exists pre_ordem_pendente boolean not null default false,
  add column if not exists pre_ordem_atualizada_em timestamptz,
  add column if not exists pre_ordem_atualizada_por uuid references public.usuarios (id);

comment on column public.orcamentos_lotes.pre_ordem_pendente is
  'true = NF importada sem o arquivo de Pré-Ordem; volta pra false quando a Pré-Ordem é subida depois (botão "Subir Pré-Ordem").';
