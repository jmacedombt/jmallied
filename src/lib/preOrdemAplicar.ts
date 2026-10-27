import type { SupabaseClient } from "@supabase/supabase-js";
import { textoOuNull, COL_NF_REMESSA_ALLIED, COL_SKU, COL_TRADE_ALLIED } from "@/lib/orcamentos";
import { validarParPreOrdem, extrairValoresPreOrdem } from "@/lib/preOrdem";

/**
 * Casa a Pré-Ordem com a Base de Orçamentos de uma NF e grava nos
 * aparelhos — regra única usada por "Subir Pré-Ordem" e por "Definir NF
 * definitiva" (pedido explícito, 27/10/2026). Por sequência (linha i com
 * linha i), conferindo quantidade, lote e SKU (validarParPreOrdem);
 * qualquer divergência recusa tudo. Passando, preenche todos os aparelhos
 * da NF (qualquer etapa), o valor do arquivo substitui o que já estava.
 */
export function conferirParPreOrdem(linhasOrcamento: unknown[][], linhasPreOrdem: unknown[][], nf: string): string | null {
  const validacao = validarParPreOrdem(linhasOrcamento, linhasPreOrdem, COL_NF_REMESSA_ALLIED, COL_SKU);
  if (validacao.ok) return null;
  if (validacao.motivo === "quantidade") {
    return `Quantidade de linhas diferente: ${validacao.linhasOrcamento} na Base de Orçamentos da NF ${nf} e ${validacao.linhasPreOrdem} na Pré-Ordem. Nada foi gravado.`;
  }
  const oQue = validacao.motivo === "lote" ? "O lote (NF Remessa)" : "O SKU";
  const exemplos = validacao.divergencias
    .slice(0, 10)
    .map((d) => `linha ${d.linha}: orçamentos="${d.valorOrcamento ?? "—"}" / pré-ordem="${d.valorPreOrdem ?? "—"}"`)
    .join("; ");
  return `${oQue} não bate em ${validacao.totalDivergencias} linha(s) — confira se é a Pré-Ordem dessa NF e se está na mesma ordem. Nada foi gravado. Ex.: ${exemplos}.`;
}

export type ResultadoAplicarPreOrdem = {
  aparelhosNaNf: number;
  preenchidas: number;
  substituidas: { trade: string; anterior: string | null; novo: string | null }[];
  jaIguais: number;
  semPreOrdemNoArquivo: number;
  foraDoArquivo: number;
};

/** Grava a Pré-Ordem (o par já tem que ter passado por conferirParPreOrdem). */
export async function aplicarPreOrdemNaNf(
  admin: SupabaseClient,
  nf: string,
  linhasOrcamento: unknown[][],
  linhasPreOrdem: unknown[][]
): Promise<{ ok: true; resultado: ResultadoAplicarPreOrdem } | { ok: false; erro: string }> {
  const valores = extrairValoresPreOrdem(linhasPreOrdem);
  const preOrdemPorTrade = new Map<string, string | null>();
  linhasOrcamento.forEach((linha, i) => {
    const trade = textoOuNull(linha[COL_TRADE_ALLIED]);
    if (trade && !preOrdemPorTrade.has(trade)) preOrdemPorTrade.set(trade, valores[i] ?? null);
  });

  const { data: aparelhos, error } = await admin
    .from("orcamentos")
    .select("id, trade_allied, pre_ordem")
    .eq("nf_remessa_allied", nf);
  if (error) return { ok: false, erro: error.message };

  type Mudanca = { id: string; trade: string; anterior: string | null; novo: string | null };
  const lista = (aparelhos ?? []) as { id: string; trade_allied: string; pre_ordem: string | null }[];
  const mudancas: Mudanca[] = [];
  let semPreOrdemNoArquivo = 0;
  let jaIguais = 0;
  let foraDoArquivo = 0;
  for (const a of lista) {
    if (!preOrdemPorTrade.has(a.trade_allied)) {
      foraDoArquivo += 1;
      continue;
    }
    const novo = preOrdemPorTrade.get(a.trade_allied) ?? null;
    if (!novo) {
      semPreOrdemNoArquivo += 1;
      continue;
    }
    if ((a.pre_ordem ?? null) === novo) jaIguais += 1;
    else mudancas.push({ id: a.id, trade: a.trade_allied, anterior: a.pre_ordem ?? null, novo });
  }

  const falhas: string[] = [];
  for (let i = 0; i < mudancas.length; i += 20) {
    const grupo = mudancas.slice(i, i + 20);
    const resultados = await Promise.all(grupo.map((m) => admin.from("orcamentos").update({ pre_ordem: m.novo }).eq("id", m.id)));
    resultados.forEach((r, idx) => {
      if (r.error) falhas.push(grupo[idx].trade);
    });
  }
  if (falhas.length > 0) {
    return {
      ok: false,
      erro: `Não consegui gravar a Pré-Ordem de ${falhas.length} aparelho(s) (ex.: ${falhas.slice(0, 5).join(", ")}). Tente de novo — o que já foi gravado não duplica.`,
    };
  }

  return {
    ok: true,
    resultado: {
      aparelhosNaNf: lista.length,
      preenchidas: mudancas.filter((m) => !m.anterior).length,
      substituidas: mudancas.filter((m) => m.anterior).map((m) => ({ trade: m.trade, anterior: m.anterior, novo: m.novo })),
      jaIguais,
      semPreOrdemNoArquivo,
      foraDoArquivo,
    },
  };
}

/** Lê a 1ª aba de uma planilha e devolve as linhas de dados (sem o cabeçalho). */
export function linhasDaPlanilha(XLSX: typeof import("xlsx"), bytes: Buffer): { cabecalho: unknown[]; linhas: unknown[][] } {
  const wb = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const todas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false }) as unknown[][];
  return { cabecalho: todas[0] ?? [], linhas: todas.slice(1) };
}
