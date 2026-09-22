-- Sistema Allied | Grupo J.Macedo
-- Migration 0061: contagem de "já reprovados" na planilha final de
-- Contra Proposta (pedido explícito) — a planilha gerada em "Enviar
-- Contra Proposta" (ver lib/contraPropostaDecisao.ts) agora também
-- inclui, no FINAL do arquivo, os aparelhos do mesmo lote (NF Remessa)
-- que já estavam em "8 - Orçamento Reprovado" antes dessa geração
-- (Allied reprovou direto na resposta de orçamento, ou reprovação manual
-- em qualquer etapa) — só informativo, não move nada de etapa (eles já
-- estão la). Essa coluna guarda quantos entraram nesse grupo, pro
-- histórico "Contra Propostas" mostrar certo.

alter table public.contra_proposta_geracoes
  add column if not exists quantidade_ja_reprovados integer not null default 0;

comment on column public.contra_proposta_geracoes.quantidade_ja_reprovados is 'Quantos aparelhos do lote já estavam em "8 - Orçamento Reprovado" ANTES dessa geração (entram no final da planilha, só informativo — não são movidos de etapa por essa geração).';
