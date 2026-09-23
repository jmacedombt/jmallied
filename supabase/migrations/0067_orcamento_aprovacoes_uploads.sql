-- Histórico do Upload (aprovação de orçamentos) em "3 - Ag. Resposta de
-- Orçamento" (pedido explícito) — cada arquivo que a Allied manda de
-- volta com o resultado (Aprovado/Contra Proposta/Reprovado) fica
-- registrado aqui: o próprio arquivo (storage, igual orcamento_envios em
-- 0033) + um resumo já calculado na hora do upload (quantidade total,
-- quantos de cada resultado, e o detalhamento por NF Remessa, já que um
-- único arquivo normalmente mistura vários lotes — ver
-- upload-aprovacao/route.ts).
--
-- Novo submenu "Validação de Orçamento (Allied)" em Operacional lê essa
-- tabela pra mostrar o histórico + o resumo (percentual de cada
-- resultado por NF Remessa) — também visível pro login ALLIED (pedido
-- explícito).

create table if not exists public.orcamento_aprovacoes_uploads (
  id uuid primary key default gen_random_uuid(),
  arquivo_path text,
  nome_arquivo text not null,
  enviado_por uuid references public.usuarios (id),
  enviado_em timestamptz not null default now(),
  linhas_no_arquivo integer not null default 0,
  linhas_nao_reconhecidas integer not null default 0,
  casadas integer not null default 0,
  nao_encontradas integer not null default 0,
  aprovados integer not null default 0,
  contra_proposta integer not null default 0,
  reprovados integer not null default 0,
  -- [{ nf_remessa_allied, total, aprovados, contra_proposta, reprovados }, ...]
  resumo_por_nf jsonb not null default '[]'::jsonb
);

comment on table public.orcamento_aprovacoes_uploads is
  'Histórico de cada arquivo de resultado (Upload aprovação de orçamentos) que a Allied manda em "3 - Ag. Resposta de Orçamento" — arquivo salvo em storage (aprovacoes-orcamentos) + resumo já calculado, com detalhamento por NF Remessa.';

create index if not exists orcamento_aprovacoes_uploads_enviado_em_idx on public.orcamento_aprovacoes_uploads (enviado_em desc);

alter table public.orcamento_aprovacoes_uploads enable row level security;

drop policy if exists "orcamento_aprovacoes_uploads_select_autenticados" on public.orcamento_aprovacoes_uploads;
create policy "orcamento_aprovacoes_uploads_select_autenticados"
  on public.orcamento_aprovacoes_uploads
  for select
  to authenticated
  using (true);

-- bucket de storage pro arquivo de cada upload de aprovação
insert into storage.buckets (id, name, public)
values ('aprovacoes-orcamentos', 'aprovacoes-orcamentos', false)
on conflict (id) do nothing;

drop policy if exists "aprovacoes_orcamentos_leitura_autenticados" on storage.objects;
create policy "aprovacoes_orcamentos_leitura_autenticados"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'aprovacoes-orcamentos');
