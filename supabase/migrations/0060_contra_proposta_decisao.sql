-- Sistema Allied | Grupo J.Macedo
-- Migration 0060: decisão (Aprovado/Reprovado) de cada item de
-- "Ag. Contra Proposta" + histórico "Contra Propostas" (novo submenu
-- dentro de Operacional, mesmo formato de "Modelo de Retorno" — ver
-- migration 0049).
--
-- Contexto: até aqui, "Enviar Contra Proposta" só reenviava por e-mail
-- pra Allied avaliar de novo (etapa "4 - Ag. Resposta de Reorçamento").
-- Esse fluxo agora é SUBSTITUÍDO por completo (pedido explícito): a
-- equipe decide, item a item, se aceita (Aprovado) ou recusa (Reprovado)
-- a Contra Proposta que a Allied mandou; feito isso pra todo o lote,
-- "Enviar Contra Proposta" gera e baixa direto uma planilha no MESMO
-- formato do arquivo de aprovação da Allied (ver lib/email.ts), já
-- combinando os 3 grupos do lote (aprovados inicialmente, contra
-- proposta aceita, contra proposta recusada) e move cada aparelho pra
-- etapa certa (Aprovado -> "5 - Ag. Peças", Reprovado -> "8 - Orçamento
-- Reprovado").
--
-- contra_proposta_decisao/motivo_recusa/decidido_em/decidido_por: gravados
-- pela nova rota /api/operacional/orcamentos/[id]/decidir-contra-proposta,
-- um por aparelho ainda em "Ag. Contra Proposta". Aprovado sempre grava
-- junto o contra_proposta_pecas/contra_proposta_mao_de_obra vigentes na
-- hora do clique (mesmo campo já usado pelo ajuste manual) — é esse
-- congelamento que a geração da planilha final usa pra "contra proposta
-- aceita". Reprovado NUNCA mexe em contra_proposta_pecas/mao_de_obra — a
-- planilha final usa o validacao_snapshot (valores ORIGINAIS enviados)
-- pra quem foi recusado, só troca o Motivo Reprova.

alter table public.orcamentos
  add column if not exists contra_proposta_decisao text check (contra_proposta_decisao in ('Aprovado', 'Reprovado')),
  add column if not exists contra_proposta_motivo_recusa text,
  add column if not exists contra_proposta_decidido_em timestamptz,
  add column if not exists contra_proposta_decidido_por uuid references public.usuarios (id);

comment on column public.orcamentos.contra_proposta_decisao is 'Decisão da equipe sobre a Contra Proposta recebida da Allied (Ag. Contra Proposta) — "Aprovado" (aceitamos o valor, vira APROVADO na planilha final) ou "Reprovado" (recusamos, mantém os valores originais + motivo na planilha final). Null enquanto ainda não foi decidido.';
comment on column public.orcamentos.contra_proposta_motivo_recusa is 'Motivo digitado ao reprovar uma Contra Proposta (pop-up com ícone de disquete) — só preenchido quando contra_proposta_decisao = Reprovado; vai pra coluna MOTIVO REPROVA da planilha final e também é copiado pra motivo_reprova quando o aparelho é movido pra "8 - Orçamento Reprovado".';

-- Histórico "Contra Propostas" (menu Operacional > Contra Propostas,
-- visível também pro login ALLIED) — mesmo princípio do Modelo de
-- Retorno (migration 0049): NÃO guarda o .xlsx em si, guarda o snapshot
-- das linhas já montadas (coluna `dados`, formato { linhas:
-- LinhaPlanilhaOrcamento[] } de lib/email.ts) e remonta o Excel igual,
-- byte a byte, sempre que alguém baixa de novo (ver
-- /api/operacional/contra-propostas/[id]/download). Diferente do Modelo
-- de Retorno, aqui NÃO existe filtro de retenção de 60 dias — decisão de
-- aprovação/recusa de orçamento tem valor de consulta por mais tempo,
-- então o registro fica disponível indefinidamente (mesmo sem nenhuma
-- limpeza automática, igual todo o resto do sistema).
create table if not exists public.contra_proposta_geracoes (
  id uuid primary key default gen_random_uuid(),
  gerado_em timestamptz not null default now(),
  gerado_por uuid references public.usuarios (id),
  nf_remessa_allied text not null,
  quantidade_aprovados_iniciais integer not null default 0,
  quantidade_contra_proposta_aceita integer not null default 0,
  quantidade_reprovados integer not null default 0,
  nome_arquivo text not null,
  dados jsonb not null
);

create index if not exists contra_proposta_geracoes_gerado_em_idx on public.contra_proposta_geracoes (gerado_em desc);
create index if not exists contra_proposta_geracoes_nf_remessa_idx on public.contra_proposta_geracoes (nf_remessa_allied);

comment on table public.contra_proposta_geracoes is 'Histórico das planilhas "Contra Propostas" geradas em Ag. Contra Proposta > Enviar Contra Proposta (menu Operacional > Contra Propostas, também visível pro login ALLIED) — guarda o snapshot das linhas (coluna dados), não o arquivo; o Excel é remontado igual sempre que consultado de novo. Sem filtro de retenção (diferente do Modelo de Retorno).';
comment on column public.contra_proposta_geracoes.dados is 'Snapshot completo: { linhas: LinhaPlanilhaOrcamento[] } — mesmo formato usado por lib/email.ts (montarPlanilhaOrcamentos) pra montar o Excel.';
comment on column public.contra_proposta_geracoes.nf_remessa_allied is 'Lote (NF Remessa) dessa geração — "Enviar Contra Proposta" sempre age sobre um lote por vez.';

alter table public.contra_proposta_geracoes enable row level security;
create policy "contra_proposta_geracoes_select_autenticados" on public.contra_proposta_geracoes for select to authenticated using (true);
