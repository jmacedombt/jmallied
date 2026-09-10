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
 * venda (o que cobramos) e a mão de obra cobrada. */
export async function buscarAparelhosAllied(
  supabase: SupabaseClient,
  statusOperacional?: string | null
): Promise<AparelhoOperacionalAllied[]> {
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
