-- Sistema Allied | Grupo J.Macedo
-- Migration 0085: Configurações > Monitoramento (pedido explícito,
-- 07/11/2026). Números de uso do Supabase pra comparar com os limites do
-- plano gratuito: tamanho do banco, arquivos no Storage (por bucket),
-- usuários de login e atividade de login nos últimos 30 dias.
-- security definer, chamada só pela rota de API (service role).
create or replace function public.monitoramento_supabase_uso()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'banco_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o), 0),
    'storage_arquivos', (select count(*) from storage.objects),
    'storage_por_bucket', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', b.bucket_id, 'bytes', b.bytes, 'arquivos', b.arquivos) order by b.bytes desc)
      from (
        select o.bucket_id, coalesce(sum((o.metadata->>'size')::bigint), 0) as bytes, count(*) as arquivos
        from storage.objects o
        group by o.bucket_id
      ) b
    ), '[]'::jsonb),
    'usuarios_login', (select count(*) from auth.users),
    'usuarios_ativos_30d', (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '30 days')
  );
$$;

revoke all on function public.monitoramento_supabase_uso() from public, anon, authenticated;
grant execute on function public.monitoramento_supabase_uso() to service_role;
