-- Sistema Allied | Grupo J.Macedo
-- Migration: fluxo de aprovação em "3 - Ag. Resposta de Orçamento" +
-- nova etapa "Ag. Contra Proposta" + histórico de envios
--
-- Três partes:
--   1) nova etapa "Ag. Contra Proposta", inserida SEM número entre
--      "3 - Ag. Resposta de Orçamento" e "4 - Ag. Resposta de
--      Reorçamento" — mesmo padrão já usado pra "Validação de
--      Orçamentos" (migration 0013): não renumera nem migra as etapas
--      seguintes, que já têm o número gravado no valor de
--      status_operacional de cada orçamento existente.
--   2) campos novos em orcamentos: o resultado da aprovação da Allied
--      (Aguardando/Aprovado/Contra Proposta/Reprovado) e o ajuste peça a
--      peça feito em "Ag. Contra Proposta" (congelado por aparelho, não
--      só os 4 totais agregados — diferente do ajuste manual de
--      Validação de Orçamentos, migration 0021).
--   3) orcamento_envios — log de cada envio confirmado (Validação de
--      Orçamentos e, mais pra frente, Contra Proposta), com o Excel
--      persistido em storage — hoje esse arquivo é gerado na hora e
--      descartado depois de mandado por e-mail; aqui passa a ficar salvo
--      pra dar pra baixar de novo depois (botão Histórico).

alter table public.orcamentos
  drop constraint if exists orcamentos_status_operacional_valido;

alter table public.orcamentos
  add constraint orcamentos_status_operacional_valido check (
    status_operacional in (
      'Ag. Abertura',
      '1 - Ag. Triagem',
      '2 - Ag. Análise',
      'Validação de Orçamentos',
      '3 - Ag. Resposta de Orçamento',
      'Ag. Contra Proposta',
      '4 - Ag. Resposta de Reorçamento',
      '5 - Ag. Peças',
      '6 - Ag. Reparo',
      '7 - Reparo Finalizado',
      '8 - Orçamento Reprovado',
      'Produto Entregue'
    )
  );

-- resultado da aprovação da Allied em "3 - Ag. Resposta de Orçamento" —
-- ATENÇÃO: campo NOVO, não é o mesmo que orcamentos.status_orcamento
-- (esse último vem da IMPORTAÇÃO original da Base de Orçamentos, coluna
-- BQ do arquivo, e seria sobrescrito a cada reimportação — não pode
-- guardar o resultado desse fluxo). Todo orçamento nasce/entra em
-- "3 - Ag. Resposta de Orçamento" como 'Aguardando' (valor padrão da
-- coluna, que a Postgres já aplica de graça pros orçamentos que já
-- estavam parados ali antes dessa migration).
alter table public.orcamentos
  add column if not exists resultado_aprovacao_allied text not null default 'Aguardando'
    constraint orcamentos_resultado_aprovacao_valido
    check (resultado_aprovacao_allied in ('Aguardando', 'Aprovado', 'Contra Proposta', 'Reprovado')),
  add column if not exists resultado_aprovacao_definido_em timestamptz;

comment on column public.orcamentos.resultado_aprovacao_allied is
  'Resultado do Upload (aprovação de orçamentos) em "3 - Ag. Resposta de Orçamento" — casado por OS Reparadora. NÃO confundir com status_orcamento (esse vem da importação original da Base de Orçamentos).';

-- ajuste peça a peça feito em "Ag. Contra Proposta" — congela, por
-- posição de peça, o custo/imposto de referência (mesmo valor que a
-- Validação de Orçamentos já tinha calculado) e o novo valor de venda
-- negociado; ao digitar, a tela recalcula tudo, mas só grava quando
-- "Confirmar alteração" é clicado. Formato de cada item do array:
-- {posicao, codigo, custo, imposto, vendaOriginal, vendaNova}.
alter table public.orcamentos
  add column if not exists contra_proposta_pecas jsonb,
  add column if not exists contra_proposta_mao_de_obra numeric,
  add column if not exists contra_proposta_ajustado boolean not null default false,
  add column if not exists contra_proposta_ajustado_por uuid references public.usuarios (id),
  add column if not exists contra_proposta_ajustado_em timestamptz;

comment on column public.orcamentos.contra_proposta_ajustado is
  'true = já foi feito o ajuste peça a peça (mão de obra + valor de cada peça) em Ag. Contra Proposta — bloqueia o botão Enviar Contra Proposta do lote até TODOS os aparelhos dele estarem assim.';

-- histórico de cada envio confirmado (Validação de Orçamentos hoje;
-- Contra Proposta também usa a partir de agora) — o Excel gerado passa a
-- ficar salvo em storage (bucket envios-orcamentos), então dá pra baixar
-- de novo depois pelo botão Histórico. Diferente de envios_email
-- (migration 0027), que só loga a TENTATIVA de e-mail (sem guardar
-- quantidade/arquivo) — essa tabela é o "lote enviado" em si.
create table if not exists public.orcamento_envios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('orcamento', 'contra_proposta')),
  nf_remessa_allied text not null,
  quantidade_aparelhos integer not null default 0,
  arquivo_path text,
  enviado_por uuid references public.usuarios (id),
  enviado_em timestamptz not null default now(),
  email_enviado boolean not null default false,
  email_erro text
);

comment on table public.orcamento_envios is
  'Histórico de cada lote confirmado/enviado (Validação de Orçamentos ou Contra Proposta) — com o Excel gerado salvo em storage (envios-orcamentos) pra poder baixar de novo depois.';

create index if not exists orcamento_envios_nf_remessa_idx on public.orcamento_envios (nf_remessa_allied);
create index if not exists orcamento_envios_tipo_idx on public.orcamento_envios (tipo, enviado_em desc);

alter table public.orcamento_envios enable row level security;

drop policy if exists "orcamento_envios_select_autenticados" on public.orcamento_envios;
create policy "orcamento_envios_select_autenticados"
  on public.orcamento_envios
  for select
  to authenticated
  using (true);

-- bucket de storage pro Excel de cada envio confirmado
insert into storage.buckets (id, name, public)
values ('envios-orcamentos', 'envios-orcamentos', false)
on conflict (id) do nothing;

drop policy if exists "envios_orcamentos_leitura_autenticados" on storage.objects;
create policy "envios_orcamentos_leitura_autenticados"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'envios-orcamentos');
