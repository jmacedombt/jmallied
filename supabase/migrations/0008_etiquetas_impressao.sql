-- Sistema Allied | Grupo J.Macedo
-- Migration: impressão de etiqueta na Ag. Triagem (popup de bipagem) +
--            menu IMPRESSÃO > Impressão Avulsa
--
-- A impressão em si acontece fora do banco (a tela web manda os dados
-- pro "Allied Print Agent", um programinha local que fala com a Zebra).
-- Aqui só guardamos: (1) quando um aparelho concluiu a triagem via essa
-- rotina (pra avançar o status_operacional), e (2) um histórico de cada
-- bipagem — encontrado ou não, impressão deu certo ou não — pra dar pra
-- auditar/depurar problema de leitor ou impressora depois.

alter table public.orcamentos
  add column if not exists triagem_concluida_por uuid references public.usuarios (id),
  add column if not exists triagem_concluida_em timestamptz;

comment on column public.orcamentos.triagem_concluida_em is
  'Quando a etiqueta da triagem foi impressa com sucesso via popup de bipagem (Ag. Triagem), avançando o aparelho pra "2 - Ag. Análise".';

create table if not exists public.etiquetas_impressoes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  tipo text not null check (tipo in ('triagem', 'avulsa')),
  codigo_bipado text not null,
  encontrado boolean not null,
  sucesso boolean not null default false,
  mensagem_erro text,
  impresso_por uuid references public.usuarios (id),
  criado_em timestamptz not null default now()
);

comment on table public.etiquetas_impressoes is
  'Histórico de cada bipagem no popup de impressão (Ag. Triagem e Impressão Avulsa) — encontrado ou não, impressão confirmada pelo Allied Print Agent ou não.';

create index if not exists etiquetas_impressoes_orcamento_id_idx on public.etiquetas_impressoes (orcamento_id);
create index if not exists etiquetas_impressoes_criado_em_idx on public.etiquetas_impressoes (criado_em desc);

alter table public.etiquetas_impressoes enable row level security;

drop policy if exists "etiquetas_impressoes_select_autenticados" on public.etiquetas_impressoes;
create policy "etiquetas_impressoes_select_autenticados"
  on public.etiquetas_impressoes
  for select
  to authenticated
  using (true);
