-- Sistema Allied | Grupo J.Macedo
-- Migration: campo Pré-Ordem em Orçamentos
--
-- A Base de Orçamentos passa a subir junto com o arquivo de Pré-Ordem
-- (gerado no sistema N3, Operacional > Relatórios > Triagem > Pré-Ordem).
-- Como os dois arquivos não têm nenhuma chave em comum, a vinculação é
-- feita por sequência (linha a linha) na própria importação — aqui só
-- guarda o valor já vinculado. Vai ser usado no encerramento do reparo
-- (de "7 - Reparo Finalizado" pra "Produto Entregue"), fluxo que ainda
-- não existe e fica pra uma próxima rodada.
alter table public.orcamentos add column if not exists pre_ordem text;

comment on column public.orcamentos.pre_ordem is
  'Número/código da Pré-Ordem (sistema N3), vinculado por sequência na importação da Base de Orçamentos a partir do arquivo de Pré-Ordem enviado junto. Usado no encerramento do reparo (Produto Entregue).';

-- guarda também o arquivo de Pré-Ordem enviado junto em cada lote, pro
-- mesmo jeito que já guarda o arquivo de orçamentos (arquivo_path)
alter table public.orcamentos_lotes add column if not exists arquivo_pre_ordem_path text;

comment on column public.orcamentos_lotes.arquivo_pre_ordem_path is
  'Caminho, no bucket bases-orcamentos, do arquivo de Pré-Ordem enviado junto com esse lote.';
