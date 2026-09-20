-- Sistema Allied | Grupo J.Macedo
-- Migration 0054: histórico de Imposto (ICMS) — pedido explícito, pra
-- acompanhar a evolução mensal do percentual usado no cálculo de lucro
-- do BID (Configurações > Imposto), num gráfico de linha com sombra
-- (mesmo estilo do R-TAT em Métricas, ver GraficoLinhaGradiente.tsx).
--
-- Uma linha por mês (chave única em `mes`, sempre gravado como o dia 1
-- do mês) — como o ICMS normalmente só muda uma vez por mês (às vezes
-- nem isso), salvar de novo dentro do mesmo mês CORRIGE aquele mês em
-- vez de criar um ponto novo no gráfico (ver upsert em
-- api/configuracoes/impostos/route.ts). `configuracoes_impostos` (id=1)
-- continua sendo o valor "ao vivo" que o BID usa pra calcular — toda vez
-- que alguém salva um novo valor na tela, os dois são atualizados juntos
-- (mesmo valor, mesmo instante, ver a mesma rota acima).
create table if not exists public.configuracoes_impostos_historico (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  icms_percentual numeric(5, 2) not null,
  atualizado_por uuid references public.usuarios (id),
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_impostos_historico_mes_unico unique (mes)
);

comment on table public.configuracoes_impostos_historico is
  'Histórico mensal do percentual de ICMS (Configurações > Imposto) — 1 linha por mês, upsert ao salvar. Base do gráfico de evolução na mesma tela.';

-- RLS: leitura liberada pra autenticados; escrita via rotina de servidor
-- com service role (mesmo padrão de configuracoes_impostos, ver
-- migration 0006), depois de conferir o cargo de quem chamou.
alter table public.configuracoes_impostos_historico enable row level security;

drop policy if exists "configuracoes_impostos_historico_select_autenticados" on public.configuracoes_impostos_historico;
create policy "configuracoes_impostos_historico_select_autenticados"
  on public.configuracoes_impostos_historico for select to authenticated using (true);

-- Dados já pedidos explicitamente pelo Rafael: Agosto/2026 = 8,45%
-- (valor que já era o padrão do sistema) e Setembro/2026 = 9,38% (valor
-- vigente a partir de agora).
insert into public.configuracoes_impostos_historico (mes, icms_percentual)
values
  (date '2026-08-01', 8.45),
  (date '2026-09-01', 9.38)
on conflict (mes) do update set icms_percentual = excluded.icms_percentual;

-- Setembro passa a ser o valor "ao vivo" que o BID usa a partir de agora.
update public.configuracoes_impostos set icms_percentual = 9.38, atualizado_em = now() where id = 1;
