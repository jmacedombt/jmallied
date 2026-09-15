-- Sistema Allied | Grupo J.Macedo
-- Migration 0044: duas coisas pedidas pro Rafael pra tela "Ag.
-- Abertura", onde vários usuários Operacional digitam a OS Reparadora
-- ao mesmo tempo:
--
--   1) Número sequencial local (1, 2, 3...) — só pra facilitar a
--      equipe se identificar durante a digitação, sem relação com o id
--      do sistema. Atribuído uma única vez (ordem de chegada em Ag.
--      Abertura) e nunca mais muda, mesmo depois do aparelho avançar
--      de etapa.
--   2) Seleção COMPARTILHADA de quais usuários Operacional estão
--      "marcados" agora, pra dividir e colorir as pendências entre a
--      equipe (1 marcado = tudo com a cor dele; 2 marcados = a lista
--      dividida ao meio; etc. — cálculo do bloco fica no app, ver
--      calcularBlocosAgAbertura em lib/orcamentos.ts).
--
-- (a duplicidade de OS Reparadora já era bloqueada desde a migration
-- 0004 — orcamentos_os_reparadora_unica_idx — nada novo precisa ser
-- feito ali.)

-- ---- 1) Número sequencial de Ag. Abertura ----

alter table public.orcamentos
  add column if not exists numero_sequencial_abertura integer;

comment on column public.orcamentos.numero_sequencial_abertura is
  'Número local da tela Ag. Abertura (1, 2, 3...) — não é o id do sistema, é só pra facilitar a equipe a se identificar durante a digitação da OS Reparadora. Atribuído uma vez (ordem de chegada em Ag. Abertura) e nunca mais alterado, mesmo depois do aparelho avançar pra próxima etapa.';

create unique index if not exists orcamentos_numero_sequencial_abertura_idx
  on public.orcamentos (numero_sequencial_abertura)
  where numero_sequencial_abertura is not null;

create sequence if not exists public.orcamentos_numero_abertura_seq;

-- backfill: numera quem já está pendente em Ag. Abertura hoje, na mesma
-- ordem que a tela já usa (created_at asc — id como desempate).
with ordenados as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.orcamentos
  where status_operacional = 'Ag. Abertura'
    and numero_sequencial_abertura is null
)
update public.orcamentos o
set numero_sequencial_abertura = ordenados.rn
from ordenados
where o.id = ordenados.id;

select setval(
  'public.orcamentos_numero_abertura_seq',
  coalesce((select max(numero_sequencial_abertura) from public.orcamentos), 0),
  true
);

-- atribui o próximo número automaticamente pra qualquer aparelho novo
-- que nascer direto em "Ag. Abertura" (import da Base de Orçamentos,
-- em src/app/api/bases/orcamentos/importar) — sem precisar mexer em
-- cada rota que faz insert.
create or replace function public.orcamentos_atribuir_numero_abertura()
returns trigger
language plpgsql
as $$
begin
  if new.status_operacional = 'Ag. Abertura' and new.numero_sequencial_abertura is null then
    new.numero_sequencial_abertura := nextval('public.orcamentos_numero_abertura_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orcamentos_numero_abertura on public.orcamentos;
create trigger trg_orcamentos_numero_abertura
  before insert on public.orcamentos
  for each row
  execute function public.orcamentos_atribuir_numero_abertura();

-- ---- 2) Seleção compartilhada de usuários Operacional em Ag. Abertura ----
-- Linha presente = usuário marcado agora. Compartilhada: qualquer
-- usuário autenticado pode ler e marcar/desmarcar (a tela mostra só os
-- de cargo "Operacional"); escrita sempre via rotina de servidor com
-- service role (ver /api/operacional/ag-abertura/selecao-usuarios).
create table if not exists public.ag_abertura_selecao_usuarios (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  selecionado_em timestamptz not null default now(),
  selecionado_por uuid references public.usuarios (id)
);

comment on table public.ag_abertura_selecao_usuarios is
  'Quem está "marcado" agora em Ag. Abertura pra dividir/colorir as pendências entre a equipe Operacional — linha presente = usuário marcado. Compartilhada entre todo mundo que acessa a tela (Realtime).';

alter table public.ag_abertura_selecao_usuarios enable row level security;

drop policy if exists "ag_abertura_selecao_usuarios_select_autenticados" on public.ag_abertura_selecao_usuarios;
create policy "ag_abertura_selecao_usuarios_select_autenticados"
  on public.ag_abertura_selecao_usuarios
  for select
  to authenticated
  using (true);

-- Realtime: pra marcar/desmarcar refletir na hora em qualquer
-- computador que estiver com a tela aberta (mesmo padrão da migration
-- 0009_realtime_orcamentos.sql).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ag_abertura_selecao_usuarios'
  ) then
    alter publication supabase_realtime add table public.ag_abertura_selecao_usuarios;
  end if;
end $$;
