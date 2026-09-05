-- Validação de Orçamentos: campos pra suportar o avanço de lote pro
-- próximo passo (3 - Ag. Resposta de Orçamento) e a confirmação manual
-- de "aparelho sem nenhuma peça lançada" (destaque amarelo na tela).

-- aparelho sem peça lançada: some obrigatoriamente ser confirmado (o
-- usuário abre o pop-up, constata que realmente não tem peça, e clica
-- pra confirmar) antes do LOTE inteiro poder avançar — evita que um
-- aparelho "esquecido" sem peça vá junto sem ninguém perceber.
alter table public.orcamentos
  add column if not exists validacao_confirmado_sem_peca boolean not null default false,
  add column if not exists validacao_confirmado_sem_peca_por uuid references public.usuarios (id),
  add column if not exists validacao_confirmado_sem_peca_em timestamptz;

comment on column public.orcamentos.validacao_confirmado_sem_peca is
  'Confirmado manualmente (pop-up de peças, Validação de Orçamentos) que esse aparelho realmente vai seguir sem nenhuma peça lançada — só mão de obra. Enquanto false, bloqueia o avanço do lote inteiro.';

-- quando o lote inteiro foi avançado de "Validação de Orçamentos" pra
-- "3 - Ag. Resposta de Orçamento" (botão "Confirmar Envio").
alter table public.orcamentos
  add column if not exists validacao_concluida_por uuid references public.usuarios (id),
  add column if not exists validacao_concluida_em timestamptz;

comment on column public.orcamentos.validacao_concluida_em is
  'Quando esse orçamento foi avançado de "Validação de Orçamentos" pra "3 - Ag. Resposta de Orçamento" (botão Confirmar Envio, em lote por NF Remessa).';
