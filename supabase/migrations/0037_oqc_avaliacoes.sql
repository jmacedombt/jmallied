-- Sistema Allied | Grupo J.Macedo
-- Migration: OQC - Controle de Qualidade (PASS / FAIL)
--
-- Duas partes:
--   1) tabela oqc_avaliacoes: uma linha por avaliação de OQC (PASS ou
--      FAIL) feita na etapa "OQC - Controle de Qualidade" — motivo só é
--      preenchido no FAIL. De propósito NÃO existe nenhum contador em
--      orcamentos: a "1x/2x/3x" de falha (pedida pelo usuário) é sempre
--      CONTADA a partir daqui (quantidade de linhas resultado='fail' por
--      orcamento_id), nunca guardada como número solto que pudesse ficar
--      dessincronizado se alguma rotina esquecesse de incrementar.
--   2) duas funções pro menu Métricas > OQC, no mesmo estilo das funções
--      de Métricas > Orçamentos (migration 0029) e Volumetria/R-TAT
--      (migration 0022):
--        - oqc_avaliacoes_periodo: uma linha por avaliação dentro de um
--          período — a tela agrupa por lote (NF Remessa) e calcula
--          reincidência em JS (lib/metricas.ts), igual já é feito com
--          agruparResultadoPorLote, sem precisar de agregação pesada no
--          banco.
--        - oqc_serie_por_periodo: PASS x FAIL já contados por bucket de
--          tempo (dia/semana/mês), pro gráfico de evolução — mesmo
--          formato de metricas_entradas_status_por_periodo.

create table if not exists public.oqc_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  resultado text not null check (resultado in ('pass', 'fail')),
  motivo text,
  avaliado_por uuid references public.usuarios (id),
  avaliado_em timestamptz not null default now(),
  -- cópias de conveniência, mesmo padrão já usado em
  -- orcamento_status_historico — evita join nas consultas de métricas.
  nf_remessa_allied text,
  trade_allied text
);

comment on table public.oqc_avaliacoes is
  'Uma linha por avaliação de OQC (PASS ou FAIL) feita em "OQC - Controle de Qualidade" — motivo só preenchido no FAIL. Base da Métrica OQC e da contagem de reincidência (quantidade de linhas fail por orcamento_id) mostrada na tag "OQC FAIL xN" em 6 - Ag. Reparo.';

create index if not exists oqc_avaliacoes_orcamento_idx on public.oqc_avaliacoes (orcamento_id, avaliado_em desc);
create index if not exists oqc_avaliacoes_periodo_idx on public.oqc_avaliacoes (avaliado_em);

alter table public.oqc_avaliacoes enable row level security;

drop policy if exists "oqc_avaliacoes_select_autenticados" on public.oqc_avaliacoes;
create policy "oqc_avaliacoes_select_autenticados"
  on public.oqc_avaliacoes
  for select
  to authenticated
  using (true);

-- sem policy de insert/update: só é gravado pelas rotas oqc-pass /
-- oqc-pass-em-massa / oqc-fail / oqc-fail-em-massa, que usam o client
-- admin (service role, ignora RLS) — mesmo padrão já usado em
-- solicitacoes_reset_senha (migration 0036).

create or replace function public.oqc_avaliacoes_periodo(
  p_inicio date,
  p_fim date
)
returns table (
  orcamento_id uuid,
  nf_remessa_allied text,
  trade_allied text,
  resultado text,
  avaliado_em timestamptz
)
language sql
stable
as $$
  select orcamento_id, nf_remessa_allied, trade_allied, resultado, avaliado_em
  from public.oqc_avaliacoes
  where avaliado_em >= p_inicio::timestamptz
    and avaliado_em < (p_fim + 1)::timestamptz
  order by avaliado_em;
$$;

create or replace function public.oqc_serie_por_periodo(
  p_granularidade text,
  p_inicio date,
  p_fim date
)
returns table (periodo date, resultado text, quantidade bigint)
language sql
stable
as $$
  select
    date_trunc(p_granularidade, avaliado_em)::date as periodo,
    resultado,
    count(*) as quantidade
  from public.oqc_avaliacoes
  where avaliado_em >= p_inicio::timestamptz
    and avaliado_em < (p_fim + 1)::timestamptz
  group by 1, 2
  order by 1, 2;
$$;
