-- Sistema Allied | Grupo J.Macedo
-- Migration 0064: guarda a posição original de cada aparelho na planilha
-- de "Base de Orçamentos" importada (pedido explícito) — hoje o sistema
-- NÃO guarda essa ordem em lugar nenhum: as buscas em orcamentos pra
-- montar a planilha de "Confirmar Envio" (Validação de Orçamentos) e a de
-- "Enviar Contra Proposta" (Ag. Contra Proposta) não têm nenhum ORDER BY,
-- então a ordem que sai hoje é essencialmente arbitrária (não bate com a
-- ordem da planilha original recebida da Allied).
--
-- `ordem_planilha` é preenchido pela importação (bases/orcamentos/importar)
-- com a posição (0, 1, 2...) de cada aparelho dentro do arquivo .xlsx que
-- foi subido — só faz sentido comparar dentro do MESMO nf_remessa_allied
-- (cada NF Remessa é um arquivo/planilha diferente). Fica null pros
-- aparelhos já importados ANTES dessa migration; uma correção à parte
-- (script/migration específica, combinada com o usuário) reconstrói esse
-- valor pros lotes já existentes a partir do arquivo original salvo no
-- Storage (bases-orcamentos).
alter table public.orcamentos add column if not exists ordem_planilha integer;

create index if not exists orcamentos_ordem_planilha_idx
  on public.orcamentos (nf_remessa_allied, ordem_planilha);

comment on column public.orcamentos.ordem_planilha is
  'Posição (0-based) desse aparelho dentro da planilha de Base de Orçamentos importada (mesmo nf_remessa_allied) — usado pra gerar a planilha de Confirmar Envio e a de Contra Proposta sempre na mesma ordem da planilha original. Null = importado antes dessa coluna existir.';
