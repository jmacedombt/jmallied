-- Sistema Allied | Grupo J.Macedo
-- Migration 0080: NF Remessa TEMPORÁRIA (pedido explícito, 27/10/2026).
-- Quando a Base de Orçamentos chega sem a NF Remessa Allied (coluna B
-- vazia), dá pra subir mesmo assim: o sistema cria uma NF temporária
-- "TEMP-DDMMAAAA" (ou -2, -3... no mesmo dia), os aparelhos seguem o
-- fluxo normal e, quando chegar o arquivo definitivo, o botão "Definir
-- NF definitiva" troca a NF temporária pela verdadeira em TODO lugar
-- (casando os aparelhos pelo Trade Allied) e, se vier junto, preenche a
-- Pré-Ordem. Enquanto for temporária, o Confirmar Envio da Validação de
-- Orçamentos fica bloqueado (a planilha da Allied leva a NF).

alter table public.orcamentos_lotes
  add column if not exists nf_temporaria boolean not null default false;

comment on column public.orcamentos_lotes.nf_temporaria is
  'true = NF Remessa criada pelo sistema (TEMP-...) porque o arquivo veio sem a NF; vira false quando a NF definitiva é informada.';

-- Troca a NF Remessa em TODAS as tabelas que guardam a NF (descobre
-- sozinha as colunas nf_remessa_allied / nf_remessa do schema public),
-- numa transação só. Usada só pelo servidor (service role).
create or replace function public.renomear_nf_remessa(p_antiga text, p_nova text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  n integer;
  resultado jsonb := '{}'::jsonb;
begin
  if p_antiga is null or p_nova is null or trim(p_antiga) = '' or trim(p_nova) = '' then
    raise exception 'NF antiga e nova são obrigatórias';
  end if;
  if exists (select 1 from public.orcamentos where nf_remessa_allied = p_nova) then
    raise exception 'A NF % já existe no sistema', p_nova;
  end if;

  for c in
    select cols.table_name, cols.column_name
    from information_schema.columns cols
    join information_schema.tables t
      on t.table_schema = cols.table_schema and t.table_name = cols.table_name
    where cols.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and cols.column_name in ('nf_remessa_allied', 'nf_remessa')
      and cols.data_type in ('text', 'character varying')
  loop
    execute format('update public.%I set %I = $1 where %I = $2', c.table_name, c.column_name, c.column_name)
      using p_nova, p_antiga;
    get diagnostics n = row_count;
    if n > 0 then
      resultado := resultado || jsonb_build_object(c.table_name || '.' || c.column_name, n);
    end if;
  end loop;

  return resultado;
end;
$$;

revoke all on function public.renomear_nf_remessa(text, text) from public, anon, authenticated;
grant execute on function public.renomear_nf_remessa(text, text) to service_role;
