-- Sistema Allied | Grupo J.Macedo
-- Migration 0070: "Consulta/Alteração" (pedido explícito, 25/09/2026) —
-- localizar um orçamento por OS Reparadora/OS Care/Trade Allied e,
-- só pra Supervisor/Gerente/Administrador, poder corrigir o campo OS
-- Reparadora (único editável). Toda alteração fica registrada aqui
-- (menu Sistema > Auditoria, só pra Administrador) por 60 dias — mesmo
-- princípio de retenção já usado em modelo_retorno_geracoes/chat
-- (migrations 0049/0069): sem cron nenhum, só um filtro de data na
-- consulta (ver /api/sistema/auditoria/route.ts).

create table if not exists public.orcamento_auditoria (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid references public.orcamentos (id) on delete cascade,
  -- campos "congelados" na hora da alteração (além do orcamento_id) —
  -- assim a Auditoria continua legível mesmo se o orçamento em si for
  -- apagado depois (ver "Zerar" em Manutenção do Banco) ou os dados
  -- mudarem de novo; não depende de JOIN pra mostrar o essencial.
  trade_allied text not null,
  os_care_allied text,
  os_reparadora_anterior text,
  os_reparadora_nova text not null,
  alterado_por uuid not null references public.usuarios (id),
  alterado_em timestamptz not null default now()
);

comment on table public.orcamento_auditoria is
  'Auditoria das alterações feitas em "Consulta/Alteração" (pedido explícito, 25/09/2026) — hoje só registra troca de OS Reparadora (único campo editável ali). Consultada só por Administrador (ver /sistema/auditoria), mostrando só os últimos 60 dias (retenção — sem cron, filtro de data na query).';

create index if not exists orcamento_auditoria_alterado_em_idx on public.orcamento_auditoria (alterado_em desc);
create index if not exists orcamento_auditoria_orcamento_id_idx on public.orcamento_auditoria (orcamento_id);

alter table public.orcamento_auditoria enable row level security;
-- (nenhuma policy — só a service role, usada nas rotas de API, acessa
-- essa tabela; mesmo padrão de chat_mensagens/usuarios_atividade.)
