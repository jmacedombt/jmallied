"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, PackageCheck, X } from "lucide-react";

export type LoteResumoEnvio = { nfRemessa: string; quantidade: number };

/**
 * Confirmação antes de mandar um bloco inteiro (Aprovados ou Recusados)
 * de "Ag. Emissão de Nota Fiscal" pra "Produto Entregue" — lista cada
 * NF Remessa e a quantidade de aparelhos daquele lote que estão indo
 * junto, pra quem confirma saber exatamente o que está sendo movido
 * (pedido explícito) antes de clicar.
 */
export default function PopupConfirmarProdutoEntregue({
  titulo,
  lotes,
  onFechar,
  onConfirmar,
}: {
  titulo: string;
  lotes: LoteResumoEnvio[];
  onFechar: () => void;
  onConfirmar: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const totalQuantidade = lotes.reduce((soma, l) => soma + l.quantidade, 0);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar pra Produto Entregue.");
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !enviando && onFechar()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageCheck size={18} style={{ color: "#22c55e" }} />
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Vai mandar {totalQuantidade} aparelho(s), de {lotes.length} NF Remessa, pra{" "}
          <strong style={{ color: "var(--ink)" }}>Produto Entregue</strong>:
        </p>

        <div className="rounded-lg border max-h-56 overflow-y-auto mb-4" style={{ borderColor: "var(--line)" }}>
          {lotes.map((l) => (
            <div
              key={l.nfRemessa}
              className="flex items-center justify-between px-3 py-2 text-sm border-t first:border-t-0"
              style={{ borderColor: "var(--line)" }}
            >
              <span style={{ color: "var(--ink)" }}>NF Remessa {l.nfRemessa}</span>
              <span style={{ color: "var(--muted)" }}>{l.quantidade} aparelho(s)</span>
            </div>
          ))}
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "#22c55e" }}
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
            {enviando ? "Enviando..." : "Confirmar envio"}
          </button>
        </div>
      </div>
    </div>
  );
}
