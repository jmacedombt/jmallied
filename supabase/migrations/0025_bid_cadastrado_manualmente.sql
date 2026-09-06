-- Sistema Allied | Grupo J.Macedo
-- Migration: marca de cadastro manual no BID
--
-- Quando uma peça é cadastrada no BID por não ter custo calculado (fluxo
-- aberto em Ag. Análise via PopupCadastrarPecaBid, rota
-- api/bases/bid/pecas/cadastro-manual), esse cadastro passa a:
--   1. marcar cadastrado_manualmente = true (essa migration);
--   2. travar automaticamente o valor (travado = true, já existente
--      desde a migration 0007) — importação do BID e "Recalcular" já
--      respeitam esse campo e nunca sobrescrevem o preço de uma peça
--      travada, então nenhuma mudança adicional é necessária aí.
--   3. se um Part Number cadastrado manualmente não aparecer numa
--      importação futura do BID, ele simplesmente não é tocado — a
--      importação só faz upsert de quem vem no arquivo, nunca apaga ou
--      altera o que não vier numa leva.
-- cadastrado_manualmente fica guardado à parte de travado porque uma
-- peça pode ser travada por outros motivos (correção manual de preço na
-- Consulta BID numa peça que já veio de importação) — só a marca
-- "cadastrado manualmente" identifica quem nasceu desse fluxo específico,
-- pro filtro "Cadastrado Manualmente" da Consulta BID.
alter table public.bid_pecas
  add column if not exists cadastrado_manualmente boolean not null default false;

comment on column public.bid_pecas.cadastrado_manualmente is
  'true quando essa peça foi criada (ou teve o custo preenchido pela primeira vez) pelo cadastro manual de Ag. Análise, por não ter custo no BID. Alimenta o filtro "Cadastrado Manualmente" da Consulta BID.';

create index if not exists bid_pecas_cadastrado_manualmente_idx on public.bid_pecas (id) where cadastrado_manualmente;
