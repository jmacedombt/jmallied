"use client";

import { X } from "lucide-react";
import { type AparelhoAgEmissaoNf } from "@/components/PainelAgEmissaoNf";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// cor de fundo de cada coluna de NF — só pra diferenciar visualmente uma
// da outra na tabela (pedido explícito), sem nenhum outro significado.
const FUNDO_NF_MAO_DE_OBRA = "rgba(59, 130, 246, 0.12)"; // azul
const FUNDO_NF_PECAS = "rgba(168, 85, 247, 0.12)"; // roxo
const FUNDO_NF_RETORNO = "rgba(249, 115, 22, 0.14)"; // laranja

function CelulaNf({ numero, valor, fundo }: { numero: string | null; valor: number | null; fundo: string }) {
  return (
    <td className="px-2.5 py-2 whitespace-nowrap" style={{ background: fundo }}>
      {numero ? (
        <>
          <p className="font-semibold leading-tight" style={{ color: "var(--ink)" }}>
            {numero}
          </p>
          <p className="text-[10px] leading-tight" style={{ color: "var(--muted)" }}>
            {formatarReal(valor ?? 0)}
          </p>
        </>
      ) : (
        <span style={{ color: "var(--muted)" }}>—</span>
      )}
    </td>
  );
}

/** Detalhe de uma NF Remessa dentro de "Ag. Emissão de Nota Fiscal" —
 * abre ao clicar na NF Remessa ou na Quantidade do resumo (ver
 * PainelAgEmissaoNf.tsx): lista os orçamentos daquele lote com os
 * dados principais, Pré Ordem em destaque, o valor individual de Mão
 * de Obra/Peças de cada um, e os números de NF já lançados (Mão de
 * Obra + Peças, só no bloco Aprovados, e Retorno nos dois blocos) —
 * cada um com uma cor de fundo diferente pra ressaltar. */
export default function PopupDetalheGrupoNf({
  nfRemessa,
  itens,
  mostrarNfMaoDeObraEPecas = false,
  onFechar,
}: {
  nfRemessa: string;
  itens: AparelhoAgEmissaoNf[];
  /** true só quando o grupo é do bloco Aprovados — Recusados não tem NF
   * de Mão de Obra/Peças, só Retorno. */
  mostrarNfMaoDeObraEPecas?: boolean;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-[1700px] max-h-[92vh] rounded-2xl border shadow-2xl p-5 overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
            NF Remessa <span style={{ color: "var(--accent2)" }}>{nfRemessa}</span> — {itens.length} aparelho(s)
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl border overflow-auto" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-2.5 py-2 font-medium">OS Reparadora</th>
                <th className="px-2.5 py-2 font-medium">Trade Allied</th>
                <th className="px-2.5 py-2 font-medium">OS Care Allied</th>
                <th className="px-2.5 py-2 font-medium">Modelo comercial</th>
                <th className="px-2.5 py-2 font-medium">SKU</th>
                <th className="px-2.5 py-2 font-medium" style={{ background: "rgba(250, 204, 21, 0.14)" }}>
                  Pré Ordem
                </th>
                <th className="px-2.5 py-2 font-medium text-right">Mão de Obra</th>
                <th className="px-2.5 py-2 font-medium text-right">Venda Peças</th>
                {mostrarNfMaoDeObraEPecas && (
                  <th className="px-2.5 py-2 font-medium" style={{ background: FUNDO_NF_MAO_DE_OBRA }}>
                    NF Mão de Obra
                  </th>
                )}
                {mostrarNfMaoDeObraEPecas && (
                  <th className="px-2.5 py-2 font-medium" style={{ background: FUNDO_NF_PECAS }}>
                    NF Peças
                  </th>
                )}
                <th className="px-2.5 py-2 font-medium" style={{ background: FUNDO_NF_RETORNO }}>
                  NF Retorno
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-2.5 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {a.os_reparadora || "—"}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {a.trade_allied}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {a.os_care_allied}
                  </td>
                  <td
                    className="px-2.5 py-2 max-w-[160px] truncate"
                    style={{ color: "var(--muted)" }}
                    title={a.modelo_comercial ?? ""}
                  >
                    {a.modelo_comercial}
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {a.sku}
                  </td>
                  <td className="px-2.5 py-2 font-semibold whitespace-nowrap" style={{ background: "rgba(250, 204, 21, 0.14)", color: "var(--ink)" }}>
                    {a.pre_ordem || "—"}
                  </td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarReal(a.maoDeObra)}
                  </td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarReal(a.vendaPecas)}
                  </td>
                  {mostrarNfMaoDeObraEPecas && (
                    <CelulaNf numero={a.nf_mao_de_obra_numero} valor={a.nf_mao_de_obra_valor} fundo={FUNDO_NF_MAO_DE_OBRA} />
                  )}
                  {mostrarNfMaoDeObraEPecas && (
                    <CelulaNf numero={a.nf_pecas_numero} valor={a.nf_pecas_valor} fundo={FUNDO_NF_PECAS} />
                  )}
                  <CelulaNf numero={a.nf_retorno_numero} valor={a.nf_retorno_valor} fundo={FUNDO_NF_RETORNO} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
