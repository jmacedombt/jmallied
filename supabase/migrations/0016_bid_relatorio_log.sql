-- histórico de emissões do Relatório BID (Bases > Relatório BID): cada
-- clique em "Gerar relatório" grava quem gerou, quando, e quantos Part
-- Numbers (peças com todos os campos preenchidos) saíram no Excel.
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

-- RLS: leitura liberada pra autenticados (mesmo padrão do resto do BID);
-- escrita só acontece via rotina de servidor com service role.
alter table public.bid_relatorio_log enable row level security;

drop policy if exists "bid_relatorio_log_select_autenticados" on public.bid_relatorio_log;
create policy "bid_relatorio_log_select_autenticados"
  on public.bid_relatorio_log for select to authenticated using (true);
