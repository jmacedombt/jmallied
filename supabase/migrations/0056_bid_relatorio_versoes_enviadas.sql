-- Sistema Allied | Grupo J.Macedo
-- Migration 0056: histórico "com cópia" do Relatório BID + versões
-- marcadas como enviadas, visíveis pro login ALLIED (pedido explícito).
--
-- Hoje bid_relatorio_log (migration 0016) já loga QUEM gerou, QUANDO e
-- QUANTOS Part Numbers saíram — mas não guarda os DADOS em si, só dá
-- pra reconstruir um relatório de novo consultando o BID como ele está
-- HOJE (que pode já ter mudado desde a geração original). Essa migration
-- acrescenta:
--   1) `dados` (snapshot das linhas exportadas, mesmo formato do Excel)
--      + `nome_aba` — junto com `nome_arquivo` (já existente), dá pra
--      baixar de novo, byte a byte, a MESMA versão gerada naquele
--      momento — mesmo padrão já usado em modelo_retorno_geracoes
--      (migration 0049). Retenção de 60 dias é só filtro na consulta
--      (`gerado_em` dentro dos últimos 60 dias), sem job/cron nenhum —
--      mesmo esquema de retenção do Modelo de Retorno.
--   2) `enviado_em`/`enviado_por` — marca uma linha específica do
--      histórico como "enviada ao cliente" (botão próprio por linha,
--      diferente do "Marcar BID como enviado" já existente, que trava
--      preço peça a peça e continua funcionando do jeito que já
--      funciona). Só linhas com enviado_em preenchido é que ficam
--      visíveis pro login ALLIED.
--
-- Descoberto ao rodar essa migration: a tabela bid_relatorio_log (que
-- deveria ter sido criada lá na migration 0016) nunca existiu de fato
-- nesse banco — por isso o Relatório BID gerava o Excel normalmente,
-- mas o histórico nunca aparecia (o insert em bid_relatorio_log falhava
-- calado, sem checagem de erro na rota antiga). O "create table" abaixo
-- (idêntico ao da 0016, com "if not exists") resolve isso também, nessa
-- mesma migration.
create table if not exists public.bid_relatorio_log (
  id uuid primary key default gen_random_uuid(),
  gerado_por uuid references public.usuarios (id),
  quantidade_part_numbers integer not null,
  nome_arquivo text not null,
  gerado_em timestamptz not null default now()
);

comment on table public.bid_relatorio_log is
  'Histórico de emissões do Relatório BID (Bases > Relatório BID) — quem exportou, quando, e quantos Part Numbers completos saíram no Excel gerado.';

create index if not exists bid_relatorio_log_gerado_em_idx on public.bid_relatorio_log (gerado_em desc);

alter table public.bid_relatorio_log enable row level security;

drop policy if exists "bid_relatorio_log_select_autenticados" on public.bid_relatorio_log;
create policy "bid_relatorio_log_select_autenticados"
  on public.bid_relatorio_log for select to authenticated using (true);

alter table public.bid_relatorio_log
  add column if not exists nome_aba text,
  add column if not exists dados jsonb,
  add column if not exists enviado_em timestamptz,
  add column if not exists enviado_por uuid references public.usuarios (id);

comment on column public.bid_relatorio_log.dados is
  'Snapshot das linhas exportadas nessa geração (modelo, part_number, peca_solucao, custo_peca_allied, mao_de_obra) — permite baixar de novo, byte a byte, sem depender do estado atual do BID. Retenção de 60 dias, só como filtro na consulta.';
comment on column public.bid_relatorio_log.enviado_em is
  'Quando essa versão específica foi marcada como "enviada" (botão na linha do histórico, ver /api/bases/bid/relatorio/[id]/marcar-enviado) — null = ainda não enviada. Só versões com isso preenchido aparecem pro login ALLIED.';

create index if not exists bid_relatorio_log_enviado_em_idx
  on public.bid_relatorio_log (enviado_em desc) where enviado_em is not null;

-- bloqueio real: ALLIED não lê bid_relatorio_log direto (mesmo padrão
-- de "orcamentos_bloqueio_allied", migration 0035, reaproveitando a
-- mesma public.cargo_atual()) — só passa pela RPC segura abaixo, que
-- nunca devolve nenhuma linha não marcada como enviada.
drop policy if exists "bid_relatorio_log_bloqueio_allied" on public.bid_relatorio_log;
create policy "bid_relatorio_log_bloqueio_allied"
  on public.bid_relatorio_log
  as restrictive
  for select
  to authenticated
  using (coalesce(public.cargo_atual(), '') <> 'ALLIED');

-- listagem seguem pro login ALLIED: só as versões marcadas como
-- enviadas, dentro dos últimos 60 dias (mesmo corte de retenção usado
-- na rota de download) — nenhuma coluna de custo aqui (o Excel da
-- versão em si tem os valores, mas esse já é o documento que o
-- parceiro está autorizado a receber; essa RPC é só a listagem).
create or replace function public.bid_relatorio_log_allied_listar()
returns table (
  id uuid,
  nome_arquivo text,
  quantidade_part_numbers integer,
  gerado_em timestamptz,
  enviado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, nome_arquivo, quantidade_part_numbers, gerado_em, enviado_em
  from public.bid_relatorio_log
  where enviado_em is not null
    and gerado_em > now() - interval '60 days'
  order by enviado_em desc;
$$;

grant execute on function public.bid_relatorio_log_allied_listar() to authenticated;
