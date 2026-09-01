-- Sistema Allied | Grupo J.Macedo
-- Migration: menu OPERACIONAL — status da ordem de serviço (OS Reparadora)
--
-- Cada aparelho de public.orcamentos passa por um status operacional
-- interno (Ag. Abertura -> ... -> Produto Entregue), independente do
-- Status Orçamento (Aprovado/Reprovado, que vem da Allied). Todo
-- aparelho nasce em "Ag. Abertura" (nunca vem com OS Reparadora
-- preenchida na importação) e avança para "1 - Ag. Triagem" assim que
-- a equipe registra o número da OS Reparadora (gerado no GSPN).

alter table public.orcamentos
  add column if not exists status_operacional text not null default 'Ag. Abertura'
    constraint orcamentos_status_operacional_valido check (
      status_operacional in (
        'Ag. Abertura',
        '1 - Ag. Triagem',
        '2 - Ag. Análise',
        '3 - Ag. Resposta de Orçamento',
        '4 - Ag. Resposta de Reorçamento',
        '5 - Ag. Peças',
        '6 - Ag. Reparo',
        '7 - Reparo Finalizado',
        '8 - Orçamento Reprovado',
        'Produto Entregue'
      )
    ),
  add column if not exists os_reparadora_definida_por uuid references public.usuarios (id),
  add column if not exists os_reparadora_definida_em timestamptz;

comment on column public.orcamentos.status_operacional is
  'Etapa do fluxo interno da ordem de serviço (gestão via menu Operacional), separado do Status Orçamento da Allied.';

-- OS Reparadora: só números, exatamente 10 caracteres (41 + 8 dígitos),
-- e nunca repetida entre aparelhos diferentes.
alter table public.orcamentos
  add constraint orcamentos_os_reparadora_formato
    check (os_reparadora is null or os_reparadora ~ '^[0-9]{10}$');

create unique index if not exists orcamentos_os_reparadora_unica_idx
  on public.orcamentos (os_reparadora)
  where os_reparadora is not null;

create index if not exists orcamentos_status_operacional_idx on public.orcamentos (status_operacional);

-- contagem de aparelhos por status, pros cards do menu Operacional
create or replace function public.orcamentos_metricas_status()
returns table (status_operacional text, quantidade bigint)
language sql
stable
as $$
  select status_operacional, count(*) as quantidade
  from public.orcamentos
  group by status_operacional;
$$;
