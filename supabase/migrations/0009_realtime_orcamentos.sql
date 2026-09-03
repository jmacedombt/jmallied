-- Habilita o Supabase Realtime na tabela orcamentos, pra dar pra ter
-- contadores de pendência que atualizam sozinhos (sem reload) nas telas
-- do Operacional, assim que um aparelho entra ou sai de uma etapa.

-- REPLICA IDENTITY FULL: por padrão o Postgres só manda a chave primária
-- no "old record" de um UPDATE/DELETE via replicação lógica. Como o
-- contador precisa saber qual era o status_operacional ANTES da
-- mudança (pra decidir se o aparelho "saiu" daquela etapa), precisamos
-- do registro antigo completo.
alter table public.orcamentos replica identity full;

-- Adiciona a tabela à publicação usada pelo Realtime, se ainda não
-- estiver lá (idempotente — não dá erro se rodar de novo).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orcamentos'
  ) then
    alter publication supabase_realtime add table public.orcamentos;
  end if;
end $$;
