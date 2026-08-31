-- Sistema Allied | Grupo J.Macedo
-- Migration: menu BASES > Base Peças
--
-- Guarda o histórico de importações da base de peças e acumula, entre
-- importações, todas as linhas de compra já vistas (sem duplicar).
-- A "base vigente" (preço/valor unitário atual de cada peça) é sempre
-- calculada a partir da linha mais recente de cada código, olhando para
-- TODA a base acumulada — não só o último arquivo importado.

-- histórico de cada upload de arquivo
create table if not exists public.pecas_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  arquivo_path text,
  importado_por uuid not null references public.usuarios (id),
  importado_em timestamptz not null default now(),
  linhas_no_arquivo integer not null default 0,
  linhas_novas_inseridas integer not null default 0,
  linhas_duplicadas_ignoradas integer not null default 0
);

comment on table public.pecas_importacoes is
  'Histórico de cada importação da planilha de compras de peças (quem, quando, resultado).';

-- linhas de compra acumuladas (uma linha = uma compra de peça)
create table if not exists public.pecas_compras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  descricao text,
  data_compra date not null,
  quantidade integer not null check (quantidade > 0),
  valor_total numeric(12, 2) not null check (valor_total > 0),
  delivery text not null,
  importacao_id uuid references public.pecas_importacoes (id) on delete set null,
  created_at timestamptz not null default now(),

  -- evita duplicar a mesma compra entre importações diferentes (ou
  -- dentro do mesmo arquivo): mesmo código + data + entrega + qtd + valor
  constraint pecas_compras_linha_unica unique (codigo, data_compra, delivery, quantidade, valor_total)
);

comment on table public.pecas_compras is
  'Todas as compras de peças já importadas (acumulado entre arquivos), sem duplicidade. Coluna H=codigo, F=data_compra, I=quantidade, J=valor_total, N=delivery da planilha original.';

create index if not exists pecas_compras_codigo_idx on public.pecas_compras (codigo);
create index if not exists pecas_compras_data_compra_idx on public.pecas_compras (data_compra desc);

-- "base vigente": para cada código, a compra mais recente (empate é
-- desempatado pela importação mais recente). É essa visão que vai
-- alimentar o BID mais pra frente.
create or replace view public.pecas_vigentes as
select distinct on (codigo)
  codigo,
  descricao,
  data_compra,
  quantidade,
  valor_total,
  round(valor_total / quantidade, 2) as valor_unitario,
  delivery
from public.pecas_compras
order by codigo, data_compra desc, created_at desc;

comment on view public.pecas_vigentes is
  'Preço/última compra vigente de cada código de peça, sempre baseado na compra mais recente já importada.';

-- resumo de métricas (peças únicas, peças registradas, data mais recente)
create or replace function public.pecas_metricas_resumo()
returns table (pecas_unicas bigint, pecas_registradas bigint, data_mais_recente date)
language sql
stable
as $$
  select
    count(distinct codigo) as pecas_unicas,
    coalesce(sum(quantidade), 0) as pecas_registradas,
    max(data_compra) as data_mais_recente
  from public.pecas_compras;
$$;

-- peças registradas agrupadas por mês, semana ou ano (p_agrupamento)
create or replace function public.pecas_metricas_periodo(p_agrupamento text)
returns table (periodo date, quantidade bigint)
language sql
stable
as $$
  select
    date_trunc(
      case
        when p_agrupamento in ('semana', 'week') then 'week'
        when p_agrupamento in ('ano', 'year') then 'year'
        else 'month'
      end,
      data_compra
    )::date as periodo,
    sum(quantidade) as quantidade
  from public.pecas_compras
  group by 1
  order by 1;
$$;

-- RLS: leitura liberada para autenticados (igual ao padrão já usado em
-- usuarios). Escrita só acontece via rotina de servidor com a service
-- role key (que ignora RLS), depois de conferir o cargo de quem chamou.
alter table public.pecas_importacoes enable row level security;
alter table public.pecas_compras enable row level security;

drop policy if exists "pecas_importacoes_select_autenticados" on public.pecas_importacoes;
create policy "pecas_importacoes_select_autenticados"
  on public.pecas_importacoes
  for select
  to authenticated
  using (true);

drop policy if exists "pecas_compras_select_autenticados" on public.pecas_compras;
create policy "pecas_compras_select_autenticados"
  on public.pecas_compras
  for select
  to authenticated
  using (true);

-- bucket de storage pra guardar o arquivo original de cada importação
insert into storage.buckets (id, name, public)
values ('bases-pecas', 'bases-pecas', false)
on conflict (id) do nothing;

drop policy if exists "bases_pecas_leitura_autenticados" on storage.objects;
create policy "bases_pecas_leitura_autenticados"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'bases-pecas');
