"use client";

import { useState } from "react";
import { Loader2, Printer, Tag, X } from "lucide-react";
import { imprimirLoteDeCaixas, quantidadeCaixas, ErroImpressaoAgente } from "@/lib/etiquetas";
import PreviewEtiquetaCaixa from "@/components/PreviewEtiquetaCaixa";

/**
 * Confirmação do botão "Etiqueta de Caixa" de cada linha (Aprovados e
 * Recusados) em PainelAgEmissaoNf — pedido explícito: antes de
 * imprimir, mostrar a prévia (a do LOTE 1, representando o layout das N
 * etiquetas que vão sair) e só imprimir depois que o operador confirmar
 * explicitamente. Uma vez confirmado, imprime em sequência todas as
 * etiquetas do lote (LOTE 1 a N — ver imprimirLoteDeCaixas em
 * lib/etiquetas.ts).
 */
export default function PopupConfirmarEtiquetaCaixa({
  nfRemessa,
  quantidadeAparelhos,
  nfRetorno,
  observacao,
  nfEntrada,
  onFechar,
}: {
  nfRemessa: string;
  quantidadeAparelhos: number;
  nfRetorno: string;
  observacao: "APROVADO" | "REPROVADO";
  nfEntrada: string;
  onFechar: () => void;
}) {
  const total = quantidadeCaixas(quantidadeAparelhos);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function confirmar() {
    setErro(null);
    setImprimindo(true);
    try {
      await imprimirLoteDeCaixas({ nfRetorno, observacao, nfEntrada, quantidadeAparelhos });
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ErroImpressaoAgente ? e.message : "Não foi possível imprimir as etiquetas de caixa.");
    }
    setImprimindo(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !imprimindo && onFechar()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Tag size={18} style={{ color: "var(--accent2)" }} />
            Etiqueta de Caixa
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={imprimindo}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          NF Remessa {nfRemessa} — {quantidadeAparelhos} aparelho(s), {total} etiqueta(s) de caixa (LOTE 1 a{" "}
          {total}). Confira a prévia (etiqueta do LOTE 1) antes de confirmar.
        </p>

        <PreviewEtiquetaCaixa
          lote="1"
          volumeAtual="1"
          volumeTotal={String(total)}
          nfRetorno={nfRetorno}
          observacao={observacao}
          nfEntrada={nfEntrada}
        />

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-1 mt-3">
            {erro}
          </p>
        )}

        {sucesso && !erro && (
          <p
            className="text-sm rounded-lg px-3 py-2 mb-1 mt-3"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e" }}
          >
            {total} etiqueta(s) enviada(s) pra impressão.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onFechar}
            disabled={imprimindo}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
          {!sucesso && (
            <button
              type="button"
              onClick={confirmar}
              disabled={imprimindo}
              className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
              style={{ background: "var(--accent2)" }}
            >
              {imprimindo ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              {imprimindo ? "Imprimindo..." : `Confirmar e Imprimir (${total})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
