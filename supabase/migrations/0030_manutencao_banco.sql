-- Sistema Allied | Grupo J.Macedo
-- Migration: menu SISTEMA > Manutenção do Banco
--
-- Três rotinas, todas chamadas só via service role (nunca pelo
-- anon/authenticated direto — ver revoke/grant no final do arquivo) e
-- sempre depois de conferir is_master na rota de servidor que chama:
--
-- 1) manutencao_tamanho_tabelas() — quanto espaço (dados + índices) cada
--    tabela do schema public está ocupando, e uma estimativa de
--    quantidade de linhas (n_live_tup do autovacuum, não um count(*) —
--    não queremos rodar count(*) em tabela grande só pra mostrar uma
--    tela). Só leitura, não altera nada.
--
-- 2) manutencao_zerar_pecas() / manutencao_zerar_gspn() /
--    manutencao_zerar_orcamentos() — zeram por completo um dos três
--    grupos de dados (fase de implantação: limpar tudo que foi testado
--    até aqui). Cada uma apaga na ordem certa pra nunca esbarrar em FK:
--      - Peças: bid_reconciliacoes (não tem "on delete cascade" a partir
--        de bid_pecas — precisa ir primeiro ou o delete de bid_pecas
--        falha) → bid_historico_valores → bid_solucoes → bid_pecas →
--        bid_recalculos → bid_importacoes → pecas_compras →
--        pecas_importacoes.
--      - GSPN: gspn_chamados → gspn_importacoes (não têm FK entre si).
--      - Orçamentos: etiquetas_impressoes (FK pra orcamentos é "on
--        delete set null" — se não apagar explicitamente, sobra
--        etiqueta órfã em vez de ir junto) → orcamento_status_historico
--        (esse já tem "on delete cascade", mas apaga explícito também)
--        → orcamentos → orcamentos_lotes.
--    De propósito NÃO mexem em usuarios nem em nenhuma configuracoes_* —
--    isso é parametrização, não dado de teste.
--
-- 3) manutencao_compactar_historico(p_meses) — rotina periódica de
--    manutenção (não precisa de confirmação forte, não é destrutiva
--    pros dados "vivos"): apaga só registros de HISTÓRICO/LOG mais
--    antigos que p_meses (padrão 12), nunca dado operacional/mestre
--    (orçamentos, bid_pecas, pecas_compras, gspn_chamados nunca são
--    tocados aqui). Ao final roda ANALYZE nas tabelas mexidas, pra
--    atualizar as estatísticas do planejador de consultas. VACUUM de
--    verdade não dá pra rodar por aqui — o Postgres não deixa VACUUM
--    ser chamado de dentro de uma function (só ANALYZE pode); quem
--    recupera o espaço das linhas apagadas é o autovacuum do Supabase,
--    que já roda sozinho em segundo plano.
create or replace function public.manutencao_tamanho_tabelas()
returns table (
  tabela text,
  linhas bigint,
  tamanho_dados text,
  tamanho_indices text,
  tamanho_total text,
  tamanho_total_bytes bigint
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    c.relname::text as tabela,
    coalesce(s.n_live_tup, 0) as linhas,
    pg_size_pretty(pg_relation_size(c.oid)) as tamanho_dados,
    pg_size_pretty(pg_indexes_size(c.oid)) as tamanho_indices,
    pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho_total,
    pg_total_relation_size(c.oid) as tamanho_total_bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;

comment on function public.manutencao_tamanho_tabelas() is
  'Tamanho em disco (dados + índices) e estimativa de linhas de cada tabela do schema public — tela Sistema > Manutenção do Banco. n_live_tup é estimativa do autovacuum, não count(*) exato.';

create or replace function public.manutencao_zerar_pecas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bid_reconciliacoes;
  delete from public.bid_historico_valores;
  delete from public.bid_solucoes;
  delete from public.bid_pecas;
  delete from public.bid_recalculos;
  delete from public.bid_importacoes;
  delete from public.pecas_compras;
  delete from public.pecas_importacoes;
end;
$$;

comment on function public.manutencao_zerar_pecas() is
  'Apaga TODA a base de Peças/BID (bid_pecas, bid_solucoes, bid_historico_valores, bid_reconciliacoes, bid_recalculos, bid_importacoes, pecas_compras, pecas_importacoes). Não mexe em usuarios nem configuracoes_*. Usado em Sistema > Manutenção do Banco, protegido por confirmação forte e permissão de master na rota que chama.';

create or replace function public.manutencao_zerar_gspn()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.gspn_chamados;
  delete from public.gspn_importacoes;
end;
$$;

comment on function public.manutencao_zerar_gspn() is
  'Apaga TODA a Base GSPN (gspn_chamados, gspn_importacoes). Usado em Sistema > Manutenção do Banco, protegido por confirmação forte e permissão de master na rota que chama.';

create or replace function public.manutencao_zerar_orcamentos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.etiquetas_impressoes;
  delete from public.orcamento_status_historico;
  delete from public.orcamentos;
  delete from public.orcamentos_lotes;
end;
$$;

comment on function public.manutencao_zerar_orcamentos() is
  'Apaga TODA a base de Orçamentos (orcamentos, orcamentos_lotes, orcamento_status_historico, etiquetas_impressoes). Usado em Sistema > Manutenção do Banco, protegido por confirmação forte e permissão de master na rota que chama.';

create or replace function public.manutencao_compactar_historico(p_meses integer default 12)
returns table(tabela text, linhas_removidas bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corte timestamptz := now() - (p_meses || ' months')::interval;
  v_linhas bigint;
begin
  if p_meses < 1 then
    raise exception 'O prazo mínimo pra compactação é de 1 mês.';
  end if;

  delete from public.orcamento_status_historico where criado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'orcamento_status_historico'; linhas_removidas := v_linhas; return next;

  delete from public.bid_historico_valores where criado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'bid_historico_valores'; linhas_removidas := v_linhas; return next;

  delete from public.bid_reconciliacoes where confirmado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'bid_reconciliacoes'; linhas_removidas := v_linhas; return next;

  delete from public.bid_recalculos where executado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'bid_recalculos'; linhas_removidas := v_linhas; return next;

  delete from public.bid_importacoes where importado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'bid_importacoes'; linhas_removidas := v_linhas; return next;

  delete from public.pecas_importacoes where importado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'pecas_importacoes'; linhas_removidas := v_linhas; return next;

  delete from public.gspn_importacoes where importado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'gspn_importacoes'; linhas_removidas := v_linhas; return next;

  delete from public.bid_relatorio_log where gerado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'bid_relatorio_log'; linhas_removidas := v_linhas; return next;

  delete from public.envios_email where enviado_em < v_corte;
  get diagnostics v_linhas = row_count;
  tabela := 'envios_email'; linhas_removidas := v_linhas; return next;

  analyze public.orcamento_status_historico;
  analyze public.bid_historico_valores;
  analyze public.bid_reconciliacoes;
  analyze public.bid_recalculos;
  analyze public.bid_importacoes;
  analyze public.pecas_importacoes;
  analyze public.gspn_importacoes;
  analyze public.bid_relatorio_log;
  analyze public.envios_email;
end;
$$;

comment on function public.manutencao_compactar_historico(integer) is
  'Apaga registros de histórico/log (orcamento_status_historico, bid_historico_valores, bid_reconciliacoes, bid_recalculos, bid_importacoes, pecas_importacoes, gspn_importacoes, bid_relatorio_log, envios_email) mais antigos que p_meses (padrão 12) e roda ANALYZE nelas depois. Nunca mexe em dado operacional/mestre (orcamentos, bid_pecas, pecas_compras, gspn_chamados). Usado em Sistema > Manutenção do Banco.';

-- Nenhuma dessas funções deve ser chamável direto pelo anon/authenticated
-- via PostgREST — só o service role (usado nas rotas de servidor, depois
-- de conferir is_master) pode executar.
revoke execute on function public.manutencao_tamanho_tabelas() from public;
revoke execute on function public.manutencao_zerar_pecas() from public;
revoke execute on function public.manutencao_zerar_gspn() from public;
revoke execute on function public.manutencao_zerar_orcamentos() from public;
revoke execute on function public.manutencao_compactar_historico(integer) from public;

grant execute on function public.manutencao_tamanho_tabelas() to service_role;
grant execute on function public.manutencao_zerar_pecas() to service_role;
grant execute on function public.manutencao_zerar_gspn() to service_role;
grant execute on function public.manutencao_zerar_orcamentos() to service_role;
grant execute on function public.manutencao_compactar_historico(integer) to service_role;
