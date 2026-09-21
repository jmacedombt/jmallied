-- Sistema Allied | Grupo J.Macedo
-- Migration 0055: módulo Financeiro (pedido explícito) — controle das
-- NFs de Mão de Obra e de Peças emitidas em Ag. Emissão de Nota Fiscal,
-- e do recebimento desses valores.
--
-- Cada linha aqui representa UM LANÇAMENTO (normalmente as duas NFs
-- saindo no mesmo dia — ver registrarLancamentoFinanceiro em
-- lib/financeiro.ts): quando alguém lança "NF Mão de Obra" ou "NF
-- Peças" em Ag. Emissão de Nota Fiscal (ver salvar-nf/route.ts), o
-- sistema procura um lançamento já criado HOJE e completa o campo que
-- faltava nele; se não achar, cria uma linha nova só com esse campo
-- preenchido. Financeiro pode corrigir/completar qualquer campo na mão
-- depois (tela /financeiro), inclusive criar um lançamento manual do
-- zero — por isso os 4 campos de NF são todos opcionais aqui (nunca os
-- dois obrigatórios juntos).
create table if not exists public.financeiro_notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  data_emissao date not null,
  nf_mao_de_obra_numero text,
  nf_mao_de_obra_valor numeric(12, 2),
  nf_pecas_numero text,
  nf_pecas_valor numeric(12, 2),
  status text not null default 'Em Aberto' check (status in ('Em Aberto', 'Vlr. Recebido')),
  data_recebimento date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id),
  -- status "Vlr. Recebido" sempre tem que vir com a data de recebimento
  -- preenchida, e "Em Aberto" nunca deveria ter uma (ver PUT
  -- api/financeiro/notas-fiscais/[id]/route.ts, que já garante isso na
  -- escrita — esse constraint é só o cinto de segurança no banco).
  constraint financeiro_notas_fiscais_recebimento_consistente check (
    (status = 'Vlr. Recebido' and data_recebimento is not null) or
    (status = 'Em Aberto' and data_recebimento is null)
  )
);

comment on table public.financeiro_notas_fiscais is
  'Módulo Financeiro > Notas Fiscais — NF Mão de Obra e NF Peças emitidas em Ag. Emissão de Nota Fiscal (populado automaticamente, ver registrarLancamentoFinanceiro em lib/financeiro.ts) e controle de recebimento do valor. Base dos 2 gráficos de evolução mensal (emitido x recebido) em financeiro/page.tsx.';

create index if not exists financeiro_notas_fiscais_data_emissao_idx
  on public.financeiro_notas_fiscais (data_emissao);

create index if not exists financeiro_notas_fiscais_data_recebimento_idx
  on public.financeiro_notas_fiscais (data_recebimento) where data_recebimento is not null;

-- RLS: leitura liberada pra autenticados (mesmo padrão de outras telas
-- de configuração/controle interno, ver configuracoes_impostos na
-- migration 0006) — quem de fato ENXERGA a tela é decidido no
-- acesso ao módulo (podeAcessarFinanceiro em lib/financeiro.ts +
-- middleware.ts), não na RLS. Escrita só via rotina de servidor com
-- service role, depois de conferir o cargo de quem chamou.
alter table public.financeiro_notas_fiscais enable row level security;

drop policy if exists "financeiro_notas_fiscais_select_autenticados" on public.financeiro_notas_fiscais;
create policy "financeiro_notas_fiscais_select_autenticados"
  on public.financeiro_notas_fiscais for select to authenticated using (true);

-- Novo cargo "Financeiro" (pedido explícito, cargo dedicado só pra esse
-- módulo) — mesmo padrão de cargo restrito de Operacional/Triagem-OQC
-- (ver migration 0047): só enxerga Financeiro + Impressão Avulsa, tudo
-- mais fica bloqueado mesmo digitando a URL direto (ver
-- financeiroRestrito/rotaBloqueadaParaFinanceiro em lib/usuarios.ts e o
-- middleware.ts).
alter table public.usuarios drop constraint if exists usuarios_cargo_check;
alter table public.usuarios add constraint usuarios_cargo_check check (
  cargo in ('Diretor', 'Gerente', 'Supervisor', 'Técnico', 'Estoque', 'Operacional', 'Triagem/OQC', 'ALLIED', 'Financeiro')
);

insert into public.cargos_customizados (nome, descricao)
values ('Financeiro', 'Controle de notas fiscais de Mão de Obra e Peças (módulo Financeiro) e do recebimento dos valores. Sem acesso a Operacional, Bases, Configurações, Sistema nem Métricas — só Financeiro e Impressão Avulsa.')
on conflict (nome) do nothing;
