import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tudo que o cargo ALLIED (login externo, só consulta) pode enxergar.
 * As duas funções abaixo só chamam RPCs "seguras" no Supabase
 * (orcamentos_allied_listar / orcamentos_backlog_resumo, ver migration
 * 0035_cargo_allied.sql) — RPCs que nunca selecionam nenhuma coluna de
 * custo/BID, então os tipos aqui nem têm campo pra isso: não tem como
 * um componente que usa esse arquivo mostrar custo por acidente, porque
 * o dado simplesmente não chega até aqui.
 */

/** Uma peça, já sem custo nenhum — só o que é mostrado pra ALLIED. */
export type PecaSeguraAllied = {
  posicao: string | null;
  codigo: string | null;
  vendaPeca: number | null;
};

export type AparelhoOperacionalAllied = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  status_operacional: string;
  data_reconhecimento: string | null;
  pedido_peca_feito: boolean;
  peca_chegou_em: string | null;
  reparo_confirmado_em: string | null;
  resultado_aprovacao_allied: string;
  quantidade_pecas: number | null;
  venda_total_pecas: number | null;
  mao_de_obra_cobrada: number | null;
  pecas: PecaSeguraAllied[] | null;
};

/** Lista os aparelhos de uma etapa (ou de todas, se `statusOperacional`
 * vier vazio) pra um login ALLIED — nunca traz custo/BID, só o valor de
 * venda (o que cobramos) e a mão de obra cobrada.
 *
 * Aceita também uma LISTA de status — necessário pra "Ag. Emissão de
 * Nota Fiscal", a única etapa que na verdade junta 2 status_operacional
 * REAIS diferentes (ver GRUPO_STATUS_AG_EMISSAO_NF em lib/orcamentos.ts;
 * o "status.valor" dessa etapa é só o rótulo da tela, nunca é gravado de
 * fato em nenhuma linha) — a RPC orcamentos_allied_listar só filtra por
 * um status por chamada, então nesse caso ela é chamada uma vez por
 * status e o resultado é combinado aqui. Sem isso, passar o rótulo
 * composto direto pra RPC não batia com nenhuma linha e a tela ficava
 * sempre vazia pro ALLIED.
 */
export async function buscarAparelhosAllied(
  supabase: SupabaseClient,
  statusOperacional?: string | string[] | null
): Promise<AparelhoOperacionalAllied[]> {
  if (Array.isArray(statusOperacional)) {
    const resultados = await Promise.all(statusOperacional.map((status) => buscarAparelhosAllied(supabase, status)));
    return resultados.flat();
  }
  const { data, error } = await supabase.rpc("orcamentos_allied_listar", {
    p_status: statusOperacional ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AparelhoOperacionalAllied[];
}

export type LinhaBacklog = {
  status_operacional: string;
  quantidade: number;
  media_rtat_dias: number | null;
};

/** Resumo da tela Backlog: quantidade + R-TAT médio por etapa numerada
 * (1 a 8) — sem nenhum valor de custo, então serve tanto pra ALLIED
 * quanto pra equipe interna. */
export async function buscarBacklog(supabase: SupabaseClient): Promise<LinhaBacklog[]> {
  const { data, error } = await supabase.rpc("orcamentos_backlog_resumo");
  if (error) throw error;
  return ((data ?? []) as { status_operacional: string; quantidade: number | string; media_rtat_dias: number | string | null }[]).map(
    (l) => ({
      status_operacional: l.status_operacional,
      quantidade: Number(l.quantidade),
      media_rtat_dias: l.media_rtat_dias == null ? null : Number(l.media_rtat_dias),
    })
  );
}

export type LinhaBacklogPorLote = {
  nf_remessa_allied: string;
  status_operacional: string;
  quantidade: number;
};

/** Detalhe por lote (Operacional > Backlog, pop-up "todos os cards" ao
 * clicar numa linha): uma linha por combinação lote (NF Remessa) +
 * QUALQUER status_operacional (não só as etapas numeradas — ver
 * migration 0053, que redefiniu essa RPC removendo o filtro numerado da
 * versão anterior). Sem custo nenhum. */
export async function buscarBacklogPorLote(supabase: SupabaseClient): Promise<LinhaBacklogPorLote[]> {
  const { data, error } = await supabase.rpc("orcamentos_backlog_por_lote");
  if (error) throw error;
  return (
    (data ?? []) as { nf_remessa_allied: string; status_operacional: string; quantidade: number | string }[]
  ).map((l) => ({
    nf_remessa_allied: l.nf_remessa_allied,
    status_operacional: l.status_operacional,
    quantidade: Number(l.quantidade),
  }));
}

export type LinhaBacklogResumoPorLote = {
  nf_remessa_allied: string;
  /** TODOS os orçamentos já importados com essa NF Remessa, em qualquer
   * status, desde sempre. */
  totalLote: number;
  /** total − entregues − reprovados: só quem ainda está de fato
   * caminhando pra virar Produto Entregue (ver migration 0053). */
  quantidadePendente: number;
  quantidadeEntregue: number;
  quantidadeReprovada: number;
  /** média de dias (hoje − Data Reconhecimento) só de quem está
   * pendente nesse lote — null quando não há nenhum (não deveria
   * acontecer, já que a RPC só traz lote com pendente > 0). */
  mediaRtatPendenteDias: number | null;
};

/** Resumo da tabela principal do Backlog (pedido explícito, substitui a
 * matriz de colunas numeradas anterior): uma linha por lote (NF Remessa)
 * ainda com algo pendente, com total do lote, quantidade pendente e
 * R-TAT médio do que está pendente — ver migration 0053. */
export async function buscarBacklogResumoPorLote(supabase: SupabaseClient): Promise<LinhaBacklogResumoPorLote[]> {
  const { data, error } = await supabase.rpc("orcamentos_backlog_resumo_por_lote");
  if (error) throw error;
  return (
    (data ?? []) as {
      nf_remessa_allied: string;
      total_lote: number | string;
      quantidade_pendente: number | string;
      quantidade_entregue: number | string;
      quantidade_reprovada: number | string;
      media_rtat_pendente_dias: number | string | null;
    }[]
  ).map((l) => ({
    nf_remessa_allied: l.nf_remessa_allied,
    totalLote: Number(l.total_lote),
    quantidadePendente: Number(l.quantidade_pendente),
    quantidadeEntregue: Number(l.quantidade_entregue),
    quantidadeReprovada: Number(l.quantidade_reprovada),
    mediaRtatPendenteDias: l.media_rtat_pendente_dias == null ? null : Number(l.media_rtat_pendente_dias),
  }));
}

export type LinhaProdutoEntreguePorLote = {
  nf_remessa_allied: string;
  /** TODOS os orçamentos já importados com essa NF Remessa, em qualquer
   * status, desde sempre. */
  totalLote: number;
  quantidadeEntregue: number;
};

/** Resumo da tela "Produto Entregue" agrupada por NF Remessa (pedido
 * explícito) — e também usado pelo card "Produto Entregue" do Painel
 * Operacional pra saber quantos LOTES distintos já têm alguma entrega
 * (ver migration 0052). Só traz lote que já tem pelo menos 1 entregue. */
export async function buscarProdutoEntreguePorLote(supabase: SupabaseClient): Promise<LinhaProdutoEntreguePorLote[]> {
  const { data, error } = await supabase.rpc("orcamentos_produto_entregue_por_lote");
  if (error) throw error;
  return (
    (data ?? []) as { nf_remessa_allied: string; total_lote: number | string; quantidade_entregue: number | string }[]
  ).map((l) => ({
    nf_remessa_allied: l.nf_remessa_allied,
    totalLote: Number(l.total_lote),
    quantidadeEntregue: Number(l.quantidade_entregue),
  }));
}
