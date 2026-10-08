-- Sistema Allied | Grupo J.Macedo
-- Migration 0075: Financeiro — status e data de recebimento POR NOTA
-- FISCAL (pedido explícito, 07/10/2026: "A baixa das notas fiscais não é
-- pelo conjunto que foi criado no dia e sim por cada uma das notas
-- fiscais").
--
-- O lançamento (linha de financeiro_notas_fiscais, que junta a NF Mão de
-- Obra e a NF Peças emitidas no mesmo dia) continua existindo do mesmo
-- jeito — só que agora cada uma das duas NFs tem o próprio status e a
-- própria data de recebimento. As colunas antigas `status` e
-- `data_recebimento` (do lançamento inteiro) deixam de ser usadas pelo
-- sistema; ficam na tabela só por histórico.

alter table public.financeiro_notas_fiscais
  add column if not exists nf_mao_de_obra_status text not null default 'Em Aberto',
  add column if not exists nf_mao_de_obra_data_recebimento date,
  add column if not exists nf_pecas_status text not null default 'Em Aberto',
  add column if not exists nf_pecas_data_recebimento date;

-- copia o status/data que o lançamento já tinha pras duas NFs dele
-- (assim nada que já foi baixado volta pra Em Aberto)
update public.financeiro_notas_fiscais
set nf_mao_de_obra_status = status,
    nf_mao_de_obra_data_recebimento = data_recebimento,
    nf_pecas_status = status,
    nf_pecas_data_recebimento = data_recebimento
where status = 'Vlr. Recebido';

-- a regra antiga (status/data do lançamento inteiro) não vale mais
alter table public.financeiro_notas_fiscais
  drop constraint if exists financeiro_notas_fiscais_recebimento_consistente;

alter table public.financeiro_notas_fiscais
  drop constraint if exists financeiro_nf_mao_de_obra_status_check;
alter table public.financeiro_notas_fiscais
  add constraint financeiro_nf_mao_de_obra_status_check check (
    (nf_mao_de_obra_status = 'Vlr. Recebido' and nf_mao_de_obra_data_recebimento is not null) or
    (nf_mao_de_obra_status = 'Em Aberto' and nf_mao_de_obra_data_recebimento is null)
  );

alter table public.financeiro_notas_fiscais
  drop constraint if exists financeiro_nf_pecas_status_check;
alter table public.financeiro_notas_fiscais
  add constraint financeiro_nf_pecas_status_check check (
    (nf_pecas_status = 'Vlr. Recebido' and nf_pecas_data_recebimento is not null) or
    (nf_pecas_status = 'Em Aberto' and nf_pecas_data_recebimento is null)
  );

comment on column public.financeiro_notas_fiscais.status is
  'OBSOLETO desde a migration 0075 — usar nf_mao_de_obra_status / nf_pecas_status.';
comment on column public.financeiro_notas_fiscais.data_recebimento is
  'OBSOLETO desde a migration 0075 — usar nf_mao_de_obra_data_recebimento / nf_pecas_data_recebimento.';
