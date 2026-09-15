-- Sistema Allied | Grupo J.Macedo
-- Migration 0047: cargo "Triagem/OQC" + tabela de registro de cargos
-- (menu SISTEMA > Cargos).
--
-- 1) Novo cargo "Triagem/OQC" (pedido explícito) — mesmo padrão de
--    restrição por etapa do cargo Operacional (ver
--    ETAPAS_LIBERADAS_POR_CARGO_RESTRITO em lib/usuarios.ts), só que
--    espelhado: função completa (incluindo ação em lote) só em
--    "1 - Ag. Triagem" e "OQC - Controle de Qualidade"; nas demais
--    etapas do Painel — inclusive Ag. Abertura — fica só consulta. Menu
--    restrito igual Operacional (só Painel + Impressão Avulsa).
--
-- 2) cargos_customizados — registro de referência dos cargos existentes
--    (nome + descrição do que cada um acessa) e formulário pra cadastrar
--    um cargo novo direto pela tela. É só um REGISTRO: cadastrar um nome
--    aqui não cria nenhuma permissão de verdade sozinho — o acesso de
--    cada módulo continua sendo implementado em código (checagens de
--    cargo espalhadas pelas telas/rotas/RLS, como todos os cargos atuais
--    foram feitos). A tela deixa isso explícito pra quem cadastra.

alter table public.usuarios drop constraint if exists usuarios_cargo_check;
alter table public.usuarios add constraint usuarios_cargo_check check (
  cargo in ('Diretor', 'Gerente', 'Supervisor', 'Técnico', 'Estoque', 'Operacional', 'Triagem/OQC', 'ALLIED')
);

create table if not exists public.cargos_customizados (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  criado_por uuid references public.usuarios (id),
  criado_em timestamptz not null default now()
);

comment on table public.cargos_customizados is
  'Registro de referência de cargos cadastrados pela tela SISTEMA > Cargos — nome + descrição do que foi pedido pra esse cargo acessar. Não concede nenhuma permissão sozinho (isso é feito em código, cargo por cargo); serve pra documentar/rastrear pedidos de cargo novo antes de virar código.';

alter table public.cargos_customizados enable row level security;

drop policy if exists "cargos_customizados_select_autenticados" on public.cargos_customizados;
create policy "cargos_customizados_select_autenticados"
  on public.cargos_customizados
  for select
  to authenticated
  using (true);

-- escrita só via rotina de servidor com service role, depois de conferir
-- o cargo de quem chamou (mesmo padrão das outras telas de
-- administração — ver podeGerenciarUsuarios em lib/usuarios.ts).
