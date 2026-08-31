-- Sistema Allied | Grupo J.Macedo
-- Migration: menu BASES > Orçamentos + menu CONFIGURAÇÕES > Mão de obra
--
-- Guarda o histórico de importações da base de orçamentos (um lote = uma
-- NF Remessa Allied) e acumula, entre importações, todos os aparelhos já
-- vistos, sem duplicar. Marca reincidência (RRR) quando o mesmo aparelho
-- (Trade Allied ou OS Care Allied) aparece numa NF Remessa diferente da
-- primeira vez em que foi visto.

-- histórico de cada upload de arquivo (cada arquivo = uma NF Remessa Allied)
create table if not exists public.orcamentos_lotes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  arquivo_path text,
  nf_remessa_allied text not null,
  importado_por uuid not null references public.usuarios (id),
  importado_em timestamptz not null default now(),
  aparelhos_no_arquivo integer not null default 0,
  aparelhos_novos_inseridos integer not null default 0,
  aparelhos_duplicados_ignorados integer not null default 0,
  aparelhos_reincidentes integer not null default 0,
  modelos_comerciais_unicos integer not null default 0,
  skus_unicos integer not null default 0
);

comment on table public.orcamentos_lotes is
  'Histórico de cada importação da planilha de orçamentos (uma NF Remessa Allied por arquivo).';

-- aparelhos acumulados (uma linha = um aparelho / Trade Allied dentro de uma NF Remessa)
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),

  reparador_terceiro text,
  nf_remessa_allied text not null,
  data_resposta_orcamento date,
  os_reparadora text,
  imei_reparadora text,
  atendimento text,
  os_care_allied text,
  trade_allied text not null,
  imei_allied text,
  classificacao_allied text,
  sku text,
  descricao_completa text,
  modelo_comercial text,

  descricao_defeito_1 text, descricao_defeito_2 text, descricao_defeito_3 text,
  descricao_defeito_4 text, descricao_defeito_5 text, descricao_defeito_6 text,
  descricao_defeito_7 text, descricao_defeito_8 text, descricao_defeito_9 text,
  descricao_defeito_10 text,

  peca_defeito_1 text, peca_defeito_2 text, peca_defeito_3 text, peca_defeito_4 text,
  peca_defeito_5 text, peca_defeito_6 text, peca_defeito_7 text, peca_defeito_8 text,
  peca_defeito_9 text, peca_defeito_10 text,

  observacao_tecnica_reparadora text,

  peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
  peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text,
  peca_add_1 text, peca_add_2 text, peca_add_3 text, peca_add_4 text, peca_add_5 text,

  custo_peca_1 numeric(12, 2), custo_peca_2 numeric(12, 2), custo_peca_3 numeric(12, 2),
  custo_peca_4 numeric(12, 2), custo_peca_5 numeric(12, 2), custo_peca_6 numeric(12, 2),
  custo_peca_7 numeric(12, 2), custo_peca_8 numeric(12, 2), custo_peca_9 numeric(12, 2),
  custo_peca_10 numeric(12, 2),
  custo_peca_add_1 numeric(12, 2), custo_peca_add_2 numeric(12, 2), custo_peca_add_3 numeric(12, 2),
  custo_peca_add_4 numeric(12, 2), custo_peca_add_5 numeric(12, 2),

  valor_total_peca numeric(12, 2) not null default 0,
  mao_de_obra numeric(12, 2) not null default 0,
  valor_total_reparo numeric(12, 2) not null default 0,

  tipo_orcamento text,
  status_orcamento text,
  motivo_reprova text,
  obs text,

  reincidente boolean not null default false,

  lote_id uuid references public.orcamentos_lotes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- evita duplicar o mesmo aparelho dentro da mesma NF Remessa (reimportar
  -- o mesmo arquivo não duplica); uma nova NF com o mesmo Trade Allied é
  -- reincidência (RRR), não duplicidade
  constraint orcamentos_linha_unica unique (nf_remessa_allied, trade_allied)
);

comment on table public.orcamentos is
  'Aparelhos recebidos da Allied para reparo, acumulado entre importações (uma NF Remessa por lote). Trade Allied = campo-chave do aparelho.';

create index if not exists orcamentos_trade_allied_idx on public.orcamentos (trade_allied);
create index if not exists orcamentos_os_care_allied_idx on public.orcamentos (os_care_allied);
create index if not exists orcamentos_nf_remessa_idx on public.orcamentos (nf_remessa_allied);

drop trigger if exists orcamentos_set_updated_at on public.orcamentos;
create trigger orcamentos_set_updated_at
  before update on public.orcamentos
  for each row
  execute function public.set_updated_at();

-- resumo de métricas acumuladas
create or replace function public.orcamentos_metricas_resumo()
returns table (
  aparelhos bigint,
  modelos_comerciais_unicos bigint,
  skus_unicos bigint,
  reincidentes bigint
)
language sql
stable
as $$
  select
    count(*) as aparelhos,
    count(distinct modelo_comercial) as modelos_comerciais_unicos,
    count(distinct sku) as skus_unicos,
    count(*) filter (where reincidente) as reincidentes
  from public.orcamentos;
$$;

-- parâmetros de mão de obra (usados no cálculo automático da coluna
-- "MÃO DE OBRA" com base na quantidade de peças usadas no reparo)
create table if not exists public.configuracoes_mao_de_obra (
  id integer primary key default 1,
  valor_sem_peca numeric(10, 2) not null default 0,
  valor_uma_peca numeric(10, 2) not null default 80,
  valor_mais_de_uma_peca numeric(10, 2) not null default 150,
  atualizado_por uuid references public.usuarios (id),
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_mao_de_obra_singleton check (id = 1)
);

comment on table public.configuracoes_mao_de_obra is
  'Valores configuráveis de mão de obra por quantidade de peças usadas no reparo (0, 1, ou mais de 1). Linha única (id=1).';

insert into public.configuracoes_mao_de_obra (id)
values (1)
on conflict (id) do nothing;

-- RLS: leitura liberada pra autenticados; escrita via rotina de servidor
-- com service role, depois de conferir o cargo de quem chamou.
alter table public.orcamentos_lotes enable row level security;
alter table public.orcamentos enable row level security;
alter table public.configuracoes_mao_de_obra enable row level security;

drop policy if exists "orcamentos_lotes_select_autenticados" on public.orcamentos_lotes;
create policy "orcamentos_lotes_select_autenticados"
  on public.orcamentos_lotes
  for select
  to authenticated
  using (true);

drop policy if exists "orcamentos_select_autenticados" on public.orcamentos;
create policy "orcamentos_select_autenticados"
  on public.orcamentos
  for select
  to authenticated
  using (true);

drop policy if exists "configuracoes_mao_de_obra_select_autenticados" on public.configuracoes_mao_de_obra;
create policy "configuracoes_mao_de_obra_select_autenticados"
  on public.configuracoes_mao_de_obra
  for select
  to authenticated
  using (true);

-- bucket de storage pra guardar o arquivo original de cada importação
insert into storage.buckets (id, name, public)
values ('bases-orcamentos', 'bases-orcamentos', false)
on conflict (id) do nothing;

drop policy if exists "bases_orcamentos_leitura_autenticados" on storage.objects;
create policy "bases_orcamentos_leitura_autenticados"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'bases-orcamentos');
