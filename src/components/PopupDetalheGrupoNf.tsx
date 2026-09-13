"use client";

import { X } from "lucide-react";
import { type AparelhoAgEmissaoNf } from "@/components/PainelAgEmissaoNf";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Detalhe de uma NF Remessa dentro de "Ag. Emissão de Nota Fiscal" —
 * abre ao clicar na NF Remessa ou na Quantidade do resumo (ver
 * PainelAgEmissaoNf.tsx): lista os orçamentos daquele lote com os
 * dados principais, Pré Ordem em destaque e o valor individual de Mão
 * de Obra/Peças de cada um. */
export default function PopupDetalheGrupoNf({
  nfRemessa,
  itens,
  onFechar,
}: {
  nfRemessa: string;
  itens: AparelhoAgEmissaoNf[];
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-4xl max-h-[85vh] rounded-2xl border shadow-2xl p-6 overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-4">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
                <th className="px-4 py-2.5 font-medium">Trade Allied</th>
                <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
                <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium" style={{ background: "rgba(250, 204, 21, 0.14)" }}>
                  Pré Ordem
                </th>
                <th className="px-4 py-2.5 font-medium text-right">Mão de Obra</th>
                <th className="px-4 py-2.5 font-medium text-right">Venda Peças</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {a.os_reparadora || "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {a.trade_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.os_care_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.modelo_comercial}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.sku}
                  </td>
                  <td className="px-4 py-2.5 font-semibold" style={{ background: "rgba(250, 204, 21, 0.14)", color: "var(--ink)" }}>
                    {a.pre_ordem || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {formatarReal(a.maoDeObra)}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {formatarReal(a.vendaPecas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
