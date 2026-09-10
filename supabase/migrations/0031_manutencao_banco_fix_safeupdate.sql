-- Sistema Allied | Grupo J.Macedo
-- Migration: corrige "DELETE requires a WHERE clause" em Sistema >
-- Manutenção do Banco
--
-- O Supabase roda com a extensão safeupdate ativa por padrão, que
-- bloqueia qualquer DELETE/UPDATE sem cláusula WHERE — vale pra
-- qualquer conexão (inclusive uma function chamada via RPC com service
-- role, não só o SQL Editor). As três funções manutencao_zerar_* criadas
-- na migration 0030 usavam "delete from tabela;" puro, que essa trava
-- rejeita com o erro "DELETE requires a WHERE clause" (visto ao clicar
-- em "Apagar tudo" na tela). Corrige recriando as três com "where true"
-- em cada delete — mesmo efeito de apagar tudo, só satisfaz a exigência
-- sintática da trava. Testado localmente (mesma ordem seguindo as FKs
-- da migration 0030) antes de entrar aqui.
create or replace function public.manutencao_zerar_pecas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bid_reconciliacoes where true;
  delete from public.bid_historico_valores where true;
  delete from public.bid_solucoes where true;
  delete from public.bid_pecas where true;
  delete from public.bid_recalculos where true;
  delete from public.bid_importacoes where true;
  delete from public.pecas_compras where true;
  delete from public.pecas_importacoes where true;
end;
$$;

create or replace function public.manutencao_zerar_gspn()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.gspn_chamados where true;
  delete from public.gspn_importacoes where true;
end;
$$;

create or replace function public.manutencao_zerar_orcamentos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.etiquetas_impressoes where true;
  delete from public.orcamento_status_historico where true;
  delete from public.orcamentos where true;
  delete from public.orcamentos_lotes where true;
end;
$$;
