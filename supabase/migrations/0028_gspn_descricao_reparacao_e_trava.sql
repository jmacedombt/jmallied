-- Base GSPN passa a capturar também "Descrição Reparação" (coluna AT do
-- arquivo) — é o texto usado como "Observação Técnica Reparadora" no
-- orçamento e, por tabela, na coluna OBS do arquivo de envio pra Allied
-- (ver lib/email.ts). E a propagação por OS Reparadora (tanto de peça
-- quanto dessa observação) passa a IGNORAR orçamento que já foi enviado
-- pra Allied (validacao_travado = true) — uma vez enviado, nenhuma base
-- deve mais alterar o orçamento sozinha; qualquer correção depois disso
-- é manual.

alter table public.gspn_chamados add column if not exists descricao_reparacao text;

create or replace function public.gspn_importar_lote(p_linhas jsonb)
returns table (chamados_novos integer, chamados_atualizados integer, pecas_casadas_orcamento integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_casados integer := 0;
begin
  with upsert as (
    insert into public.gspn_chamados (
      os_reparadora, asc_job_no, status, motivo, descricao_reparacao,
      peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, atualizado_em
    )
    select
      l.os_reparadora, l.asc_job_no, l.status, l.motivo, l.descricao_reparacao,
      l.peca_1, l.peca_2, l.peca_3, l.peca_4, l.peca_5, l.peca_6, l.peca_7, l.peca_8, l.peca_9, l.peca_10, now()
    from jsonb_to_recordset(p_linhas) as l(
      os_reparadora text, asc_job_no text, status text, motivo text, descricao_reparacao text,
      peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
      peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text
    )
    on conflict (os_reparadora) do update
    set asc_job_no = excluded.asc_job_no,
        status = excluded.status,
        motivo = excluded.motivo,
        descricao_reparacao = excluded.descricao_reparacao,
        peca_1 = excluded.peca_1, peca_2 = excluded.peca_2, peca_3 = excluded.peca_3,
        peca_4 = excluded.peca_4, peca_5 = excluded.peca_5, peca_6 = excluded.peca_6,
        peca_7 = excluded.peca_7, peca_8 = excluded.peca_8, peca_9 = excluded.peca_9,
        peca_10 = excluded.peca_10, atualizado_em = now()
    returning (xmax = 0) as inserido
  )
  select
    count(*) filter (where inserido),
    count(*) filter (where not inserido)
  into v_novos, v_atualizados
  from upsert;

  -- propaga peças + observação técnica pra orçamentos, casando pela OS
  -- Reparadora — só em orçamento que ainda não foi enviado pra Allied
  -- (validacao_travado = true fica intocado: correção depois do envio é
  -- sempre manual, nunca por importação de base).
  update public.orcamentos o
  set peca_1 = l.peca_1, peca_2 = l.peca_2, peca_3 = l.peca_3, peca_4 = l.peca_4, peca_5 = l.peca_5,
      peca_6 = l.peca_6, peca_7 = l.peca_7, peca_8 = l.peca_8, peca_9 = l.peca_9, peca_10 = l.peca_10,
      observacao_tecnica_reparadora = l.descricao_reparacao
  from jsonb_to_recordset(p_linhas) as l(
    os_reparadora text, descricao_reparacao text,
    peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
    peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text
  )
  where o.os_reparadora = l.os_reparadora
    and o.validacao_travado = false;

  get diagnostics v_casados = row_count;

  return query select v_novos, v_atualizados, v_casados;
end;
$$;
