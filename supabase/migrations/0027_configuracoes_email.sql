-- Sistema Allied | Grupo J.Macedo
-- Migration: Configurações > E-mail
--
-- Base pro envio automático de e-mail (com planilha em anexo) ao
-- confirmar o envio de um lote em Validação de Orçamentos ("Confirmar
-- Envio" -> confirmar no pop-up de revisão). Três peças:
--   1) configuracoes_email — remetente e texto padrão (assunto/corpo),
--      linha única (id sempre 1), editável em Configurações > E-mail.
--   2) configuracoes_email_destinatarios — lista fixa de e-mails que
--      recebem TODO envio (não varia por lote/reparadora).
--   3) envios_email — log de cada tentativa (sucesso ou erro), pra dar
--      pra conferir/depurar sem precisar checar o painel do Resend.
--
-- A chave de API do serviço de envio (Resend) NÃO fica no banco — é uma
-- variável de ambiente da Vercel (RESEND_API_KEY), fora do alcance de
-- quem só tem acesso à tela de Configurações.

create table if not exists public.configuracoes_email (
  id integer primary key default 1,
  remetente_nome text not null default 'Sistema Allied - Grupo J.Macedo',
  -- precisa bater com um domínio verificado no Resend pra sair de fato;
  -- fica null até alguém preencher na tela de Configurações.
  remetente_email text,
  -- texto livre com placeholders {{nf_remessa}}, {{quantidade}} etc.,
  -- substituídos na hora do envio (ver lib/email.ts).
  assunto_padrao text not null default 'Orçamento(s) - NF Remessa {{nf_remessa}}',
  corpo_padrao text not null default
    'Segue em anexo a planilha com o(s) orçamento(s) referente(s) à NF Remessa {{nf_remessa}} ({{quantidade}} aparelho(s)).',
  atualizado_por uuid references public.usuarios (id),
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_email_singleton check (id = 1)
);

comment on table public.configuracoes_email is
  'Configuração única (id=1) do remetente e do texto padrão do e-mail automático de Validação de Orçamentos.';

insert into public.configuracoes_email (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.configuracoes_email_destinatarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text,
  ativo boolean not null default true,
  criado_por uuid references public.usuarios (id),
  criado_em timestamptz not null default now()
);

comment on table public.configuracoes_email_destinatarios is
  'Lista fixa de e-mails que recebem, sempre, o e-mail automático disparado ao confirmar o envio de um lote em Validação de Orçamentos. "ativo" = false pausa o envio pra esse endereço sem apagar o cadastro.';

create table if not exists public.envios_email (
  id uuid primary key default gen_random_uuid(),
  nf_remessa_allied text not null,
  destinatarios text[] not null,
  assunto text not null,
  status text not null check (status in ('enviado', 'erro')),
  erro_mensagem text,
  resend_id text,
  enviado_por uuid references public.usuarios (id),
  enviado_em timestamptz not null default now()
);

comment on table public.envios_email is
  'Log de cada tentativa de envio automático de e-mail (sucesso ou erro) — pra conferir/depurar sem precisar checar o painel do Resend. Uma falha de envio aqui não impede o lote de avançar de etapa.';

create index if not exists envios_email_nf_remessa_idx on public.envios_email (nf_remessa_allied);

-- RLS: leitura liberada pra autenticados; escrita via rotina de servidor
-- com service role, depois de conferir o cargo de quem chamou (mesmo
-- padrão das outras telas de Configurações).
alter table public.configuracoes_email enable row level security;
alter table public.configuracoes_email_destinatarios enable row level security;
alter table public.envios_email enable row level security;

drop policy if exists "configuracoes_email_select_autenticados" on public.configuracoes_email;
create policy "configuracoes_email_select_autenticados"
  on public.configuracoes_email
  for select
  to authenticated
  using (true);

drop policy if exists "configuracoes_email_destinatarios_select_autenticados" on public.configuracoes_email_destinatarios;
create policy "configuracoes_email_destinatarios_select_autenticados"
  on public.configuracoes_email_destinatarios
  for select
  to authenticated
  using (true);

drop policy if exists "envios_email_select_autenticados" on public.envios_email;
create policy "envios_email_select_autenticados"
  on public.envios_email
  for select
  to authenticated
  using (true);
