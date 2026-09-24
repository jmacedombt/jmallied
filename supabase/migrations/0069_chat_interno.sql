-- Sistema Allied | Grupo J.Macedo
-- Migration 0069: Chat interno (pedido explícito, 23/09/2026) —
-- mensagem direta entre 2 usuários (online ou não), "chamar atenção"
-- (nudge estilo MSN) e status manual (Disponível/Ausente/Ocupado).
-- Visível/usável por QUALQUER login, inclusive ALLIED.

-- ---------------------------------------------------------------------
-- Status manual (Disponível/Ausente/Ocupado)
-- ---------------------------------------------------------------------
-- Escolhido pela própria pessoa (ver usuarios_definir_status abaixo); só
-- é levado em conta enquanto ela está "online" (heartbeat recente, ver
-- usuarios_atividade da migration 0058) — offline sempre aparece como
-- "Ausente" pros outros, independente do que tinha selecionado antes de
-- sair (o front-end decide isso, não o banco).
alter table public.usuarios_atividade
  add column if not exists status_manual text not null default 'Disponivel'
    check (status_manual in ('Disponivel', 'Ausente', 'Ocupado'));

comment on column public.usuarios_atividade.status_manual is
  'Status escolhido pela própria pessoa (Disponivel/Ausente/Ocupado) — só vale enquanto ela está online; offline sempre aparece como Ausente pros outros (decidido no front-end).';

create or replace function public.usuarios_definir_status(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('Disponivel', 'Ausente', 'Ocupado') then
    raise exception 'status inválido: %', p_status;
  end if;

  insert into public.usuarios_atividade (usuario_id, ultimo_login_em, ultima_atividade_em, status_manual)
  values (auth.uid(), now(), now(), p_status)
  on conflict (usuario_id) do update
    set status_manual = excluded.status_manual,
        ultima_atividade_em = now();
end;
$$;

grant execute on function public.usuarios_definir_status(text) to authenticated;

-- "Usuários Online" passa a trazer também o status_manual (pedido
-- explícito) — substitui a versão da migration 0068, mesma lista, só
-- com essa coluna a mais. Precisa de DROP antes: Postgres não deixa
-- trocar o tipo de retorno (colunas de saída) de uma função existente
-- só com CREATE OR REPLACE.
drop function if exists public.usuarios_online_listar();

create or replace function public.usuarios_online_listar()
returns table (
  id uuid,
  nome text,
  sobrenome text,
  cargo text,
  ultimo_login_em timestamptz,
  ultima_atividade_em timestamptz,
  status_manual text
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.nome, u.sobrenome, u.cargo, ua.ultimo_login_em, ua.ultima_atividade_em, ua.status_manual
  from public.usuarios_atividade ua
  join public.usuarios u on u.id = ua.usuario_id
  where ua.ultima_atividade_em > now() - interval '5 minutes'
  order by ua.ultima_atividade_em desc;
$$;

grant execute on function public.usuarios_online_listar() to authenticated;

-- ---------------------------------------------------------------------
-- Mensagens do chat interno + "chamar atenção"
-- ---------------------------------------------------------------------
-- tipo='mensagem': mensagem direta normal (texto obrigatório).
-- tipo='chamar_atencao': o "nudge" estilo MSN (texto opcional, o
-- front-end já manda uma frase padrão tipo "🔔 quer falar com você").
-- Mensagens (dos 2 tipos) somem sozinhas depois de 60 dias — ver a
-- limpeza best-effort em lib/chat.ts, rodada a cada envio (sem cron:
-- mais simples e já resolve, já que o chat é usado o dia inteiro).
create table if not exists public.chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  remetente_id uuid not null references public.usuarios (id) on delete cascade,
  destinatario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo text not null default 'mensagem' check (tipo in ('mensagem', 'chamar_atencao')),
  texto text,
  enviado_em timestamptz not null default now(),
  lida_em timestamptz
);

comment on table public.chat_mensagens is
  'Chat interno (pedido explícito, 23/09/2026) — mensagem direta entre 2 usuários (online ou não) e "chamar atenção" (nudge estilo MSN, tipo=chamar_atencao). Mensagens somem sozinhas depois de 60 dias (limpeza best-effort em lib/chat.ts, a cada envio). Visível/usável por QUALQUER login, inclusive ALLIED. RLS sem nenhuma policy — só a service role (rotas de API) acessa, mesmo padrão de usuarios_atividade.';

create index if not exists chat_mensagens_destinatario_idx on public.chat_mensagens (destinatario_id, enviado_em desc);
create index if not exists chat_mensagens_remetente_idx on public.chat_mensagens (remetente_id, enviado_em desc);
create index if not exists chat_mensagens_nao_lidas_idx on public.chat_mensagens (destinatario_id, lida_em);
create index if not exists chat_mensagens_enviado_em_idx on public.chat_mensagens (enviado_em);

alter table public.chat_mensagens enable row level security;
-- (nenhuma policy — só a service role, usada nas rotas de API, acessa
-- essa tabela; mesmo padrão de usuarios_atividade na migration 0058.)
