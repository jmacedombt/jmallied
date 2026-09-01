-- Sistema Allied | Grupo J.Macedo
-- Migration: menu BASES > BID + BASES > Pendências BID
--            + CONFIGURAÇÕES > Faixas de Markup (BID) e Imposto (ICMS)
--
-- BID = tabela de preços padronizada pela Allied. Uma "peça" do BID é
-- identificada por Modelo + Part Number (não por linha do arquivo — um
-- mesmo Part Number pode aparecer com várias "Peça Solução" diferentes,
-- que viram registros filhos em bid_solucoes, com uma marcada como
-- principal). O custo vem sempre da Base Peças (código mais recente,
-- view pecas_vigentes) multiplicado pela faixa de markup configurável;
-- "Custo Peça (Allied)" é sempre espelho desse valor calculado.

-- histórico de cada upload do arquivo BID
create table if not exists public.bid_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  arquivo_path text,
  importado_por uuid not null references public.usuarios (id),
  importado_em timestamptz not null default now(),
  linhas_no_arquivo integer not null default 0,
  linhas_sem_part_number_descartadas integer not null default 0,
  linhas_sem_peca_solucao_descartadas integer not null default 0,
  linhas_vazias_descartadas integer not null default 0,
  linhas_duplicadas_ignoradas integer not null default 0,
  pecas_novas_inseridas integer not null default 0,
  pecas_atualizadas integer not null default 0,
  solucoes_novas_inseridas integer not null default 0
);

comment on table public.bid_importacoes is
  'Histórico de cada importação do arquivo BID (quem, quando, resultado).';

-- peças do BID: uma linha por Modelo + Part Number
create table if not exists public.bid_pecas (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  part_number text not null,
  custo_peca_samsung numeric(12, 2),
  valor_com_margem numeric(12, 2),
  custo_peca_allied numeric(12, 2),
  mao_de_obra numeric(12, 2),
  bid_importacao_id uuid references public.bid_importacoes (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint bid_pecas_modelo_part_number_unica unique (modelo, part_number)
);

comment on table public.bid_pecas is
  'Peças do BID (Modelo + Part Number). custo_peca_samsung = mais recente da Base Peças; valor_com_margem/custo_peca_allied = calculado pela faixa de markup (custo_peca_allied é sempre espelho de valor_com_margem). Nulo em custo_peca_samsung = pendente (Part Number ainda não comprado/importado na Base Peças).';

create index if not exists bid_pecas_part_number_idx on public.bid_pecas (part_number);
create index if not exists bid_pecas_pendentes_idx on public.bid_pecas (id) where custo_peca_samsung is null;

drop trigger if exists bid_pecas_set_atualizado_em on public.bid_pecas;
create or replace function public.bid_pecas_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
create trigger bid_pecas_set_atualizado_em
  before update on public.bid_pecas
  for each row
  execute function public.bid_pecas_set_atualizado_em();

-- "peça solução" (descrição do reparo) de cada peça do BID — um Part
-- Number pode ter mais de uma; a exibida por padrão é a marcada como
-- principal (a primeira importada), com opção de trocar depois.
create table if not exists public.bid_solucoes (
  id uuid primary key default gen_random_uuid(),
  bid_peca_id uuid not null references public.bid_pecas (id) on delete cascade,
  peca_solucao text not null,
  principal boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint bid_solucoes_peca_solucao_unica unique (bid_peca_id, peca_solucao)
);

comment on table public.bid_solucoes is
  'Descrições de "Peça Solução" de cada peça do BID. Uma marcada como principal (exibida por padrão na tela); as demais aparecem como opção de troca.';

-- garante no máximo uma solução principal por peça
create unique index if not exists bid_solucoes_principal_unica_idx
  on public.bid_solucoes (bid_peca_id)
  where principal;

create index if not exists bid_solucoes_bid_peca_id_idx on public.bid_solucoes (bid_peca_id);

-- histórico de variação de valor de cada peça do BID (reimportação do
-- BID, atualização da Base Peças ou clique em "Recalcular")
create table if not exists public.bid_historico_valores (
  id uuid primary key default gen_random_uuid(),
  bid_peca_id uuid not null references public.bid_pecas (id) on delete cascade,
  custo_peca_samsung_anterior numeric(12, 2),
  custo_peca_samsung_novo numeric(12, 2),
  valor_com_margem_anterior numeric(12, 2),
  valor_com_margem_novo numeric(12, 2),
  origem text not null check (origem in ('importacao_bid', 'recalculo')),
  alterado_por uuid references public.usuarios (id),
  criado_em timestamptz not null default now()
);

comment on table public.bid_historico_valores is
  'Toda mudança de custo_peca_samsung/valor_com_margem de uma peça do BID — por reimportação do BID ou por clique em "Recalcular" (após a Base Peças mudar).';

create index if not exists bid_historico_valores_bid_peca_id_idx on public.bid_historico_valores (bid_peca_id, criado_em desc);

-- faixas de markup configuráveis (Configurações > Faixas de Markup BID):
-- custo da Base Peças dentro da faixa [valor_min, valor_max] (valor_max
-- nulo = "acima de") multiplica pelo campo multiplicador.
create table if not exists public.configuracoes_bid_markup (
  id uuid primary key default gen_random_uuid(),
  valor_min numeric(12, 2) not null,
  valor_max numeric(12, 2),
  multiplicador numeric(6, 3) not null,
  ordem integer not null,
  atualizado_por uuid references public.usuarios (id),
  atualizado_em timestamptz not null default now()
);

comment on table public.configuracoes_bid_markup is
  'Faixas de markup do BID: Custo Peça (Allied) = teto(custo_peca_samsung x multiplicador, 2 casas). valor_max nulo = "acima de".';

insert into public.configuracoes_bid_markup (valor_min, valor_max, multiplicador, ordem)
select * from (values
  (0::numeric, 10::numeric, 4::numeric, 1),
  (10.01::numeric, 50::numeric, 3::numeric, 2),
  (50.01::numeric, 100::numeric, 2::numeric, 3),
  (100.01::numeric, 500::numeric, 1.5::numeric, 4),
  (500.01::numeric, 1000::numeric, 1.4::numeric, 5),
  (1000.01::numeric, null::numeric, 1.3::numeric, 6)
) as faixas(valor_min, valor_max, multiplicador, ordem)
where not exists (select 1 from public.configuracoes_bid_markup);

-- imposto (ICMS) — configuração inicial; fórmula de lucro entra depois
create table if not exists public.configuracoes_impostos (
  id integer primary key default 1,
  icms_percentual numeric(5, 2) not null default 8.45,
  atualizado_por uuid references public.usuarios (id),
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_impostos_singleton check (id = 1)
);

comment on table public.configuracoes_impostos is
  'Percentual de imposto (ICMS) usado no cálculo de lucro do BID. Valor único (id=1).';

insert into public.configuracoes_impostos (id)
values (1)
on conflict (id) do nothing;

-- RLS: leitura liberada pra autenticados; escrita via rotina de servidor
-- com service role, depois de conferir o cargo de quem chamou.
alter table public.bid_importacoes enable row level security;
alter table public.bid_pecas enable row level security;
alter table public.bid_solucoes enable row level security;
alter table public.bid_historico_valores enable row level security;
alter table public.configuracoes_bid_markup enable row level security;
alter table public.configuracoes_impostos enable row level security;

drop policy if exists "bid_importacoes_select_autenticados" on public.bid_importacoes;
create policy "bid_importacoes_select_autenticados"
  on public.bid_importacoes for select to authenticated using (true);

drop policy if exists "bid_pecas_select_autenticados" on public.bid_pecas;
create policy "bid_pecas_select_autenticados"
  on public.bid_pecas for select to authenticated using (true);

drop policy if exists "bid_solucoes_select_autenticados" on public.bid_solucoes;
create policy "bid_solucoes_select_autenticados"
  on public.bid_solucoes for select to authenticated using (true);

drop policy if exists "bid_historico_valores_select_autenticados" on public.bid_historico_valores;
create policy "bid_historico_valores_select_autenticados"
  on public.bid_historico_valores for select to authenticated using (true);

drop policy if exists "configuracoes_bid_markup_select_autenticados" on public.configuracoes_bid_markup;
create policy "configuracoes_bid_markup_select_autenticados"
  on public.configuracoes_bid_markup for select to authenticated using (true);

drop policy if exists "configuracoes_impostos_select_autenticados" on public.configuracoes_impostos;
create policy "configuracoes_impostos_select_autenticados"
  on public.configuracoes_impostos for select to authenticated using (true);

-- bucket de storage pra guardar o arquivo original de cada importação do BID
insert into storage.buckets (id, name, public)
values ('bases-bid', 'bases-bid', false)
on conflict (id) do nothing;

drop policy if exists "bases_bid_leitura_autenticados" on storage.objects;
create policy "bases_bid_leitura_autenticados"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'bases-bid');
