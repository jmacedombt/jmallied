-- Sistema Allied | Grupo J.Macedo
-- Migration: histórico de status + funções pro menu Métricas
--
-- Toda vez que orcamentos.status_operacional muda (não importa qual
-- rotina fez isso — hoje são 6+ rotas diferentes, e não dá pra confiar
-- em instrumentar cada uma na mão sem esquecer uma), um trigger grava
-- uma linha aqui com o status anterior, o novo e quando mudou. Também
-- grava uma linha na criação do orçamento (status_anterior = null),
-- pra já existir um ponto de partida pra medir quanto tempo ele fica na
-- primeira etapa (Ag. Abertura).
--
-- Combinado com orcamentos.data_reconhecimento (a data que o aparelho
-- chegou fisicamente na loja — já existe desde 0005_reconhecimento_lote),
-- esse histórico é a base do menu Métricas > R-TAT: TAT total é sempre
-- data_reconhecimento até o orçamento fechar (Produto Entregue ou
-- 8 - Orçamento Reprovado) ou até agora se ainda estiver em aberto;
-- TAT por status é o tempo entre uma linha e a próxima do mesmo
-- orçamento aqui (ou até agora, pra etapa atual).
--
-- Sem backfill: orçamentos que já estavam em andamento antes dessa
-- migration só ganham histórico a partir da PRÓXIMA mudança de status
-- deles — o tempo que já passaram na etapa atual não entra na conta
-- (decisão consciente: inventar uma data de entrada pra eles bagunçaria
-- o TAT por status desses orçamentos antigos).

create table if not exists public.orcamento_status_historico (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  mudou_em timestamptz not null default now(),
  -- cópia de conveniência, igual o padrão já usado em
  -- orcamentos.data_reconhecimento (evita join nas consultas de
  -- métricas, que já são pesadas o suficiente com window functions)
  nf_remessa_allied text,
  data_reconhecimento date
);

comment on table public.orcamento_status_historico is
  'Log de toda mudança de status_operacional de um orçamento — gravado automaticamente pelo trigger trg_orcamentos_historico_status. Base do menu Métricas (Volumetria/R-TAT).';

create index if not exists orcamento_status_historico_orcamento_idx
  on public.orcamento_status_historico (orcamento_id, mudou_em);

create index if not exists orcamento_status_historico_status_idx
  on public.orcamento_status_historico (status_novo, mudou_em);

create index if not exists orcamento_status_historico_reconhecimento_idx
  on public.orcamento_status_historico (data_reconhecimento);

alter table public.orcamento_status_historico enable row level security;

drop policy if exists "orcamento_status_historico_select_autenticados" on public.orcamento_status_historico;
create policy "orcamento_status_historico_select_autenticados"
  on public.orcamento_status_historico
  for select
  to authenticated
  using (true);

-- trigger: grava uma linha na criação (status_anterior null) e uma a
-- cada mudança real de status_operacional (ignora update que resalva o
-- mesmo valor).
create or replace function public.fn_orcamentos_historico_status()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.orcamento_status_historico
      (orcamento_id, status_anterior, status_novo, mudou_em, nf_remessa_allied, data_reconhecimento)
    values
      (NEW.id, null, NEW.status_operacional, now(), NEW.nf_remessa_allied, NEW.data_reconhecimento);
  elsif TG_OP = 'UPDATE' and NEW.status_operacional is distinct from OLD.status_operacional then
    insert into public.orcamento_status_historico
      (orcamento_id, status_anterior, status_novo, mudou_em, nf_remessa_allied, data_reconhecimento)
    values
      (NEW.id, OLD.status_operacional, NEW.status_operacional, now(), NEW.nf_remessa_allied, NEW.data_reconhecimento);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orcamentos_historico_status on public.orcamentos;
create trigger trg_orcamentos_historico_status
  after insert or update of status_operacional on public.orcamentos
  for each row
  execute function public.fn_orcamentos_historico_status();

-- ---- Métricas > Volumetria ----

-- quantos aparelhos foram RECONHECIDOS (chegaram na loja) por período —
-- p_granularidade é qualquer unidade aceita por date_trunc ('day',
-- 'week', 'month').
create or replace function public.metricas_reconhecidos_por_periodo(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, quantidade bigint)
language sql
stable
as $$
  select
    date_trunc(p_granularidade, o.data_reconhecimento)::date as periodo,
    count(*) as quantidade
  from public.orcamentos o
  where o.data_reconhecimento is not null
    and o.data_reconhecimento >= p_inicio
    and o.data_reconhecimento <= p_fim
  group by 1
  order by 1;
$$;

-- quantos aparelhos ENTRARAM em cada status por período (a partir do
-- histórico) — dá tanto "todo mundo que entrou em X" quanto, filtrando
-- pelos dois status finais na camada de aplicação, "quantos foram
-- finalizados" (Produto Entregue / 8 - Orçamento Reprovado).
create or replace function public.metricas_entradas_status_por_periodo(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, status text, quantidade bigint)
language sql
stable
as $$
  select
    date_trunc(p_granularidade, h.mudou_em)::date as periodo,
    h.status_novo as status,
    count(*) as quantidade
  from public.orcamento_status_historico h
  where h.mudou_em >= p_inicio::timestamptz
    and h.mudou_em < (p_fim + 1)::timestamptz
  group by 1, 2
  order by 1, 2;
$$;

-- estoque atual por status já existe: public.orcamentos_metricas_status()
-- (migration 0004_operacional.sql) — reaproveitado direto pelo menu
-- Métricas > Volumetria, sem precisar de função nova.

-- ---- Métricas > R-TAT ----

-- R-TAT TOTAL: de data_reconhecimento até o orçamento fechar (Produto
-- Entregue / 8 - Orçamento Reprovado) ou até agora se ainda estiver em
-- aberto — médio por período, agrupado pela safra (quando o aparelho foi
-- reconhecido), não por quando fechou.
create or replace function public.metricas_rtat_total_por_periodo(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, tat_medio_dias numeric, quantidade bigint)
language sql
stable
as $$
  with base as (
    select
      o.id,
      o.data_reconhecimento,
      case
        when o.status_operacional in ('Produto Entregue', '8 - Orçamento Reprovado') then
          coalesce(
            (
              select h.mudou_em
              from public.orcamento_status_historico h
              where h.orcamento_id = o.id
                and h.status_novo = o.status_operacional
              order by h.mudou_em desc
              limit 1
            ),
            now()
          )
        else now()
      end as fim
    from public.orcamentos o
    where o.data_reconhecimento is not null
      and o.data_reconhecimento >= p_inicio
      and o.data_reconhecimento <= p_fim
  )
  select
    date_trunc(p_granularidade, data_reconhecimento)::date as periodo,
    avg(extract(epoch from (fim - data_reconhecimento::timestamptz)) / 86400.0) as tat_medio_dias,
    count(*) as quantidade
  from base
  group by 1
  order by 1;
$$;

-- R-TAT POR STATUS: quanto tempo (em dias) cada aparelho ficou em cada
-- status — pega o intervalo entre uma linha do histórico e a próxima do
-- mesmo orçamento (LEAD), ou até agora quando é a etapa atual (linha
-- mais recente) — médio por período, também agrupado pela safra
-- (data_reconhecimento).
--
-- Importante: usa o data_reconhecimento AO VIVO de public.orcamentos
-- (join), nunca a cópia denormalizada gravada na própria linha do
-- histórico — porque o Reconhecimento de Lote pode ser definido DEPOIS
-- que o aparelho já mudou de status pela primeira vez (ex: importado
-- em "Ag. Abertura" antes do lote ser reconhecido), e nesse caso a
-- cópia gravada naquela hora ainda estaria null.
create or replace function public.metricas_rtat_por_status(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, status text, tat_medio_dias numeric, quantidade bigint)
language sql
stable
as $$
  with estadias as (
    select
      h.status_novo as status,
      h.mudou_em as entrou_em,
      coalesce(lead(h.mudou_em) over (partition by h.orcamento_id order by h.mudou_em), now()) as saiu_em,
      o.data_reconhecimento
    from public.orcamento_status_historico h
    join public.orcamentos o on o.id = h.orcamento_id
  )
  select
    date_trunc(p_granularidade, data_reconhecimento)::date as periodo,
    status,
    avg(extract(epoch from (saiu_em - entrou_em)) / 86400.0) as tat_medio_dias,
    count(*) as quantidade
  from estadias
  where data_reconhecimento is not null
    and data_reconhecimento >= p_inicio
    and data_reconhecimento <= p_fim
  group by 1, 2
  order by 1, 2;
$$;
