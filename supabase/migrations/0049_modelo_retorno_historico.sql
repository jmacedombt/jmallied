-- Sistema Allied | Grupo J.Macedo
-- Migration 0049: histórico das planilhas "Modelo de Retorno" geradas em
-- "Ag. Emissão de Nota Fiscal" (botão "Emitir planilha de retorno" — ver
-- PopupConfirmarProdutoEntregue.tsx / lib/modeloRetorno.ts) — pedido
-- explícito de ter um novo submenu "Modelo de Retorno", dentro de
-- Operacional, pra consultar/baixar de novo depois.
--
-- NÃO guarda o arquivo .xlsx em si (não precisa de bucket de storage
-- novo): guarda só o SNAPSHOT dos dados usados pra montar a planilha
-- naquela hora (coluna `dados`, mesmo formato de
-- { aprovados, recusados, solucoesPorPartNumber } de
-- lib/modeloRetorno.ts) — o Excel é remontado igual, byte a byte,
-- sempre que alguém baixa de novo (ver
-- /api/operacional/modelo-retorno/[id]/download), usando a
-- `data_referencia` gravada aqui (não a data de hoje), pra sair
-- idêntico ao que foi baixado na hora da emissão.
--
-- `assinatura` é um hash do snapshot, usado só pra não duplicar
-- registro quando "Emitir planilha de retorno" é clicado de novo sem
-- nada ter mudado desde a última emissão: se bater com o último
-- registro gravado (o mais recente por `gerado_em`), a rota de
-- registro só atualiza esse registro (gerado_em/gerado_por/
-- nome_arquivo/data_referencia) em vez de inserir outro — pedido
-- explícito.
--
-- Retenção de 60 dias é só um FILTRO nas consultas (`gerado_em` dentro
-- dos últimos 60 dias) — esse projeto não tem nenhum job/cron (nem
-- pg_cron, nem edge function agendada, nem Vercel Cron) pra apagar
-- linha nenhuma automaticamente; um registro mais antigo que 60 dias
-- simplesmente para de aparecer na tela e no download, mas continua
-- fisicamente no banco (mesmo padrão hoje usado por outros históricos
-- desse sistema, que também não têm limpeza automática nenhuma).

create table if not exists public.modelo_retorno_geracoes (
  id uuid primary key default gen_random_uuid(),
  gerado_em timestamptz not null default now(),
  gerado_por uuid references public.usuarios (id),
  quantidade_aprovados integer not null default 0,
  quantidade_recusados integer not null default 0,
  nfs_remessa text[] not null default '{}',
  nome_arquivo text not null,
  data_referencia text not null,
  assinatura text not null,
  dados jsonb not null
);

create index if not exists modelo_retorno_geracoes_gerado_em_idx on public.modelo_retorno_geracoes (gerado_em desc);

comment on table public.modelo_retorno_geracoes is 'Histórico das planilhas "Modelo de Retorno" geradas em Ag. Emissão de Nota Fiscal (menu Operacional > Modelo de Retorno) — guarda o snapshot dos dados (coluna dados), não o arquivo; o Excel é remontado igual sempre que consultado de novo. Consulta/download filtram só os últimos 60 dias (retenção sem job automático).';
comment on column public.modelo_retorno_geracoes.assinatura is 'Hash do snapshot (dados+contagens) — usado só pra não duplicar registro quando a mesma planilha é emitida de novo sem nada mudar (atualiza o registro mais recente em vez de inserir outro).';
comment on column public.modelo_retorno_geracoes.data_referencia is 'DDMMAAAA (fuso Brasília) do momento da emissão original — usado ao remontar a planilha depois, pra sair com a MESMA aba/nome de arquivo, não a data de hoje.';
comment on column public.modelo_retorno_geracoes.dados is 'Snapshot completo: { aprovados: ItemModeloRetorno[], recusados: ItemModeloRetorno[], solucoesPorPartNumber: Record<string,string> } — o mesmo formato usado por lib/modeloRetorno.ts pra montar o Excel.';

alter table public.modelo_retorno_geracoes enable row level security;
create policy "modelo_retorno_geracoes_select_autenticados" on public.modelo_retorno_geracoes for select to authenticated using (true);
