-- A importação da Base GSPN, em arquivos grandes (milhares de linhas),
-- estava fazendo 3 idas ao banco por lote (checar existentes, upsert na
-- Base GSPN, propagar pra orçamentos) — em arquivos grandes isso passava
-- de 40 chamadas seguidas e estourava o tempo limite da função no
-- servidor. Essa função junta as 3 operações numa só chamada por lote,
-- numa transação só, e já devolve os contadores prontos (novos,
-- atualizados, casados com orçamento) — sem precisar de nenhuma consulta
-- extra de "checar antes".
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
  -- upsert na Base GSPN por OS Reparadora — "xmax = 0" no retorno indica
  -- que a linha foi inserida agora (chamado novo); qualquer outro valor
  -- indica que já existia e só foi atualizada.
  with upsert as (
    insert into public.gspn_chamados (
      os_reparadora, asc_job_no, status, motivo,
      peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, atualizado_em
    )
    select
      l.os_reparadora, l.asc_job_no, l.status, l.motivo,
      l.peca_1, l.peca_2, l.peca_3, l.peca_4, l.peca_5, l.peca_6, l.peca_7, l.peca_8, l.peca_9, l.peca_10, now()
    from jsonb_to_recordset(p_linhas) as l(
      os_reparadora text, asc_job_no text, status text, motivo text,
      peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
      peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text
    )
    on conflict (os_reparadora) do update
    set asc_job_no = excluded.asc_job_no,
        status = excluded.status,
        motivo = excluded.motivo,
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

  -- propaga as peças pra tabela de orçamentos, casando pela OS Reparadora
  -- (sempre sobrescreve as 10 posições, igual antes)
  update public.orcamentos o
  set peca_1 = l.peca_1, peca_2 = l.peca_2, peca_3 = l.peca_3, peca_4 = l.peca_4, peca_5 = l.peca_5,
      peca_6 = l.peca_6, peca_7 = l.peca_7, peca_8 = l.peca_8, peca_9 = l.peca_9, peca_10 = l.peca_10
  from jsonb_to_recordset(p_linhas) as l(
    os_reparadora text,
    peca_1 text, peca_2 text, peca_3 text, peca_4 text, peca_5 text,
    peca_6 text, peca_7 text, peca_8 text, peca_9 text, peca_10 text
  )
  where o.os_reparadora = l.os_reparadora;

  get diagnostics v_casados = row_count;

  return query select v_novos, v_atualizados, v_casados;
end;
$$;
