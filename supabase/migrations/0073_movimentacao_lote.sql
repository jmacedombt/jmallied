-- Sistema Allied | Grupo J.Macedo
-- Migration 0073: "Movimentar" (menu Operacional, pedido explícito,
-- 03/10/2026) — trocar o status_operacional de vários orçamentos de uma
-- vez a partir de uma lista (Trade Allied ou OS Reparadora) subida em
-- arquivo (.xlsx ou .txt). Só Administrador (is_master) ou Gerente (ver
-- podeMovimentarOrcamentos em lib/orcamentos.ts, mesma trava de
-- podeVoltarEtapaAgEmissaoNf/podeRetrocederProdutoEntregue).
--
-- Essa ferramenta pula todas as regras normais de cada etapa — só troca
-- o status_operacional em si (ver /api/operacional/movimentar/confirmar),
-- sem preencher nenhum campo de aprovação/detalhe que as telas normais
-- preenchem. Por isso toda alteração fica registrada aqui, pra dar pra
-- rastrear depois quem moveu o quê (mesmo princípio de orcamento_auditoria,
-- migration 0070, mas sem retenção de 60 dias — mais sensível, fica pra
-- sempre). lote_id agrupa os itens de uma mesma submissão.

create table if not exists public.orcamento_movimentacao_lote (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null,
  orcamento_id uuid references public.orcamentos (id) on delete cascade,
  -- campos "congelados" na hora da movimentação (além do orcamento_id) —
  -- assim o histórico continua legível mesmo se o orçamento for apagado
  -- depois (ver "Zerar" em Manutenção do Banco) ou os dados mudarem de
  -- novo; não depende de JOIN pra mostrar o essencial.
  trade_allied text not null,
  os_care_allied text,
  os_reparadora text,
  status_anterior text not null,
  status_novo text not null,
  movimentado_por uuid not null references public.usuarios (id),
  movimentado_em timestamptz not null default now()
);

comment on table public.orcamento_movimentacao_lote is
  'Auditoria da tela "Movimentar" (menu Operacional, pedido explícito, 03/10/2026) — troca manual de status_operacional em lote, a partir de upload de lista (Trade Allied/OS Reparadora). lote_id agrupa os itens de uma mesma submissão. Consultada só por Administrador (ver /sistema/auditoria), sem limite de retenção.';

create index if not exists orcamento_movimentacao_lote_movimentado_em_idx on public.orcamento_movimentacao_lote (movimentado_em desc);
create index if not exists orcamento_movimentacao_lote_lote_id_idx on public.orcamento_movimentacao_lote (lote_id);
create index if not exists orcamento_movimentacao_lote_orcamento_id_idx on public.orcamento_movimentacao_lote (orcamento_id);

alter table public.orcamento_movimentacao_lote enable row level security;
-- (nenhuma policy — só a service role, usada nas rotas de API, acessa
-- essa tabela; mesmo padrão de orcamento_auditoria/chat_mensagens.)
