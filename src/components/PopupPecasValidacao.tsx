"use client";

import { PackageSearch, X } from "lucide-react";
import { type DetalheValidacaoOrcamento } from "@/lib/orcamentos";

export type AparelhoValidacaoDetalhe = DetalheValidacaoOrcamento & {
  nf_remessa_allied: string;
  os_reparadora: string | null;
  trade_allied: string;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up com o detalhe de um orçamento em Validação de Orçamentos: valor
// da mão de obra, código de cada peça lançada e o custo/imposto dela
// (sempre a partir do valor mais recente da Base Peças). Mais campos
// entram aqui conforme o Rafael for detalhando o que falta.
export default function PopupPecasValidacao({
  aparelho,
  onFechar,
}: {
  aparelho: AparelhoValidacaoDetalhe;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Peças do orçamento
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

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          {aparelho.trade_allied} · OS Reparadora {aparelho.os_reparadora || "—"} · NF Remessa{" "}
          {aparelho.nf_remessa_allied}
        </p>

        {aparelho.pecas.length === 0 ? (
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Nenhuma peça lançada pra esse orçamento ainda.
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Código da peça</th>
                  <th className="px-3 py-2 font-medium text-right">Custo (Base Peças)</th>
                  <th className="px-3 py-2 font-medium text-right">Imposto (ICMS)</th>
                </tr>
              </thead>
              <tbody>
                {aparelho.pecas.map((p) => (
                  <tr
                    key={p.posicao}
                    className="border-t"
                    style={{
                      borderColor: p.custo == null ? "#ef4444" : "var(--line)",
                      background: p.custo == null ? "rgba(239, 68, 68, 0.08)" : undefined,
                    }}
                  >
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {p.posicao}
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                      {p.codigo}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: p.custo == null ? "#ef4444" : "var(--ink)" }}>
                      {p.custo == null ? "Sem custo na Base Peças" : formatarReal(p.custo)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarReal(p.imposto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="rounded-xl border p-4 space-y-1.5 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Quantidade de peças</span>
            <strong style={{ color: "var(--ink)" }}>{aparelho.quantidadePecas}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Custo das peças</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.custoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Imposto (ICMS)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.impostoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Mão de obra</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.maoDeObra)}</strong>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Valor total do reparo</span>
            <strong style={{ color: "var(--accent2)" }}>
              {formatarReal(aparelho.valorTotalPecas + aparelho.maoDeObra)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
