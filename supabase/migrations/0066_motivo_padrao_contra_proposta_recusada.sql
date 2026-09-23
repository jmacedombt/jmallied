-- Corrige retroativamente o motivo de recusa de TODO orçamento que já
-- teve a Contra Proposta reprovada antes da frase padrão existir
-- (pedido explícito): a partir de agora, o pop-up "Reprovar Contra
-- Proposta" já vem pré-preenchido com essa frase (continua editável
-- pra um caso diferente), mas os registros que já foram reprovados
-- antes dessa mudança ficam com o motivo antigo/livre até essa
-- correção rodar. Sobrescreve TODOS, mesmo quem já tinha um motivo
-- diferente escrito (pedido explícito).
--
-- Só mexe em contra_proposta_motivo_recusa (orcamentos) — a correção da
-- planilha/snapshot já gerada (contra_proposta_geracoes.dados) é feita
-- pelo código (ver corrigirOrdemPlanilhas.ts), reaproveitando o mesmo
-- botão "Corrigir ordem das planilhas já geradas" em Sistema >
-- Manutenção do Banco.

update orcamentos
set contra_proposta_motivo_recusa = 'Contra Proposta Recusada - Abaixo dos custos de peças'
where contra_proposta_decisao = 'Reprovado';
