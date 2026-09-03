-- Base GSPN (menu Bases > Base GSPN): chamados exportados do sistema
-- Samsung GSPN, uma linha por OS Reparadora. Cada importação nova
-- atualiza os chamados existentes (por OS Reparadora) e insere os que
-- ainda não existiam — nunca apaga nada só por não vir numa leva.
create table if not exists public.gspn_chamados (
  id uuid primary key default gen_random_uuid(),
  os_reparadora text not null unique,
  asc_job_no text,
  status text,
  motivo text,
  peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
  peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.gspn_chamados is
  'Base GSPN: chamados exportados do sistema Samsung GSPN, uma linha por OS Reparadora. Importação nova atualiza por OS Reparadora (upsert), sem apagar chamados que não vierem no arquivo. As peças daqui são propagadas pra orcamentos.peca_1..10 pelo mesmo OS Reparadora (ver função gspn_propagar_pecas).';

create index if not exists gspn_chamados_status_idx on public.gspn_chamados (status);

alter table public.gspn_chamados enable row level security;
drop policy if exists "gspn_chamados_select_autenticados" on public.gspn_chamados;
create policy "gspn_chamados_select_autenticados"
  on public.gspn_chamados for select to authenticated using (true);

-- Um registro por importação, pra mostrar o resumo ("atualizado em X por
-- Y, com tal resultado") na tela de Base GSPN.
create table if not exists public.gspn_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  importado_por uuid references public.usuarios (id),
  importado_em timestamptz not null default now(),
  linhas_no_arquivo integer not null default 0,
  linhas_invalidas integer not null default 0,
  chamados_novos integer not null default 0,
  chamados_atualizados integer not null default 0,
  pecas_casadas_orcamento integer not null default 0,
  pecas_nao_casadas_orcamento integer not null default 0
);

alter table public.gspn_importacoes enable row level security;
drop policy if exists "gspn_importacoes_select_autenticados" on public.gspn_importacoes;
create policy "gspn_importacoes_select_autenticados"
  on public.gspn_importacoes for select to authenticated using (true);

-- Propaga as peças da Base GSPN pra tabela de orçamentos, casando pela
-- OS Reparadora. Sempre sobrescreve as 10 posições (peca_1..10) com o
-- que está no GSPN agora — inclusive deixando em branco uma posição que
-- saiu de lá — pra sempre refletir a última versão importada. Não mexe
-- em custo_peca_1..10 nem no valor total do reparo.
--
-- p_linhas: array de objetos { os_reparadora, peca_1..peca_10 }.
-- Retorna quantos aparelhos da base de orçamentos foram encontrados e
-- atualizados (pra contabilizar "casados" vs "não casados" no resumo).
--
-- Observação: hoje sempre sobrescreve, sem checar trava alguma — a
-- trava de "orçamento definido, não recebe mais alteração de nenhuma
-- base" é um recurso futuro (ainda não existe no sistema).
create or replace function public.gspn_propagar_pecas(p_linhas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atualizados integer;
begin
  update public.orcamentos o
  set peca_1 = l.peca_1, peca_2 = l.peca_2, peca_3 = l.peca_3, peca_4 = l.peca_4, peca_5 = l.peca_5,
      peca_6 = l.peca_6, peca_7 = l.peca_7, peca_8 = l.peca_8, peca_9 = l.peca_9, peca_10 = l.peca_10
  from jsonb_to_recordset(p_linhas) as l(
    os_reparadora text,
    peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
    peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text
  )
  where o.os_reparadora = l.os_reparadora;

  get diagnostics v_atualizados = row_count;
  return v_atualizados;
end;
$$;
