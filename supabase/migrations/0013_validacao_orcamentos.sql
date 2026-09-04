-- Nova etapa "Validação de Orçamentos", entre "2 - Ag. Análise" e
-- "3 - Ag. Resposta de Orçamento" — sem número, pra não precisar
-- renumerar/migrar as etapas seguintes (3 a 8) que já têm o número
-- gravado no valor de status_operacional de cada orçamento existente.
alter table public.orcamentos
  drop constraint if exists orcamentos_status_operacional_valido;

alter table public.orcamentos
  add constraint orcamentos_status_operacional_valido check (
    status_operacional in (
      'Ag. Abertura',
      '1 - Ag. Triagem',
      '2 - Ag. Análise',
      'Validação de Orçamentos',
      '3 - Ag. Resposta de Orçamento',
      '4 - Ag. Resposta de Reorçamento',
      '5 - Ag. Peças',
      '6 - Ag. Reparo',
      '7 - Reparo Finalizado',
      '8 - Orçamento Reprovado',
      'Produto Entregue'
    )
  );

-- rastreia quem confirmou que a análise ("2 - Ag. Análise") foi
-- realizada, avançando o orçamento pra "Validação de Orçamentos" —
-- mesmo padrão já usado em triagem_concluida_por/triagem_concluida_em.
alter table public.orcamentos
  add column if not exists analise_confirmada_por uuid references public.usuarios (id),
  add column if not exists analise_confirmada_em timestamptz;

comment on column public.orcamentos.analise_confirmada_em is
  'Quando o técnico confirmou que a análise foi realizada, avançando o orçamento de "2 - Ag. Análise" para "Validação de Orçamentos". NULL = ainda não confirmado.';
