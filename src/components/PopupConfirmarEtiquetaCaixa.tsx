"use client";

import { useState } from "react";
import { Loader2, Minus, Plus, Printer, Tag, X } from "lucide-react";
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
 *
 * A quantidade de etiquetas começa no cálculo automático (21 aparelhos
 * por caixa), mas o operador pode ajustar pra mais ou pra menos antes de
 * confirmar (pedido explícito) — útil quando a separação física das
 * caixas não bate exatamente com a conta.
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
  const totalSugerido = quantidadeCaixas(quantidadeAparelhos);
  const [total, setTotal] = useState(totalSugerido);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function ajustarTotal(delta: number) {
    setSucesso(false);
    setTotal((atual) => Math.max(1, Math.min(999, atual + delta)));
  }

  function digitarTotal(valor: string) {
    setSucesso(false);
    const numero = parseInt(valor, 10);
    if (!Number.isNaN(numero)) {
      setTotal(Math.max(1, Math.min(999, numero)));
    } else if (valor === "") {
      setTotal(1);
    }
  }

  async function confirmar() {
    setErro(null);
    setImprimindo(true);
    try {
      await imprimirLoteDeCaixas({ nfRetorno, observacao, nfEntrada, quantidadeAparelhos, totalCaixas: total });
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
          NF Remessa {nfRemessa} — {quantidadeAparelhos} aparelho(s). Sugestão automática: {totalSugerido} etiqueta(s)
          de caixa (21 aparelhos por caixa). Ajuste se precisar.
        </p>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Quantidade de etiquetas (LOTE 1 a {total})
        </label>
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => ajustarTotal(-1)}
            disabled={imprimindo || total <= 1}
            aria-label="Diminuir"
            className="w-9 h-9 flex items-center justify-center rounded-lg border transition hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Minus size={15} />
          </button>
          <input
            type="number"
            min={1}
            max={999}
            value={total}
            onChange={(e) => digitarTotal(e.target.value)}
            disabled={imprimindo}
            className="w-16 text-center rounded-lg border px-2 py-2 text-sm outline-none transition"
            style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={() => ajustarTotal(1)}
            disabled={imprimindo}
            aria-label="Aumentar"
            className="w-9 h-9 flex items-center justify-center rounded-lg border transition hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Plus size={15} />
          </button>
          {total !== totalSugerido && (
            <button
              type="button"
              onClick={() => {
                setSucesso(false);
                setTotal(totalSugerido);
              }}
              disabled={imprimindo}
              className="text-xs underline ml-1"
              style={{ color: "var(--accent2)" }}
            >
              usar sugestão ({totalSugerido})
            </button>
          )}
        </div>

        <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Prévia (etiqueta do LOTE 1)
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
