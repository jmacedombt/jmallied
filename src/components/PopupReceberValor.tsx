"use client";

import { useState } from "react";
import { CalendarCheck2, Loader2, RotateCcw, Wallet, X } from "lucide-react";
import { hojeIso, type LinhaFinanceiro } from "@/lib/financeiro";

/**
 * Pop-up de mudança de Status de um lançamento (pedido explícito: "o
 * status inicial sem Em Aberto e com opção de alterar para Vlr.
 * Recebido / Ao lado ao mudar para o Status de valor recebido tem que
 * colocar a data de recebimento do valor"). Também cobre o caminho
 * inverso (reverter uma marcação feita errado), sem precisar apagar o
 * lançamento — mesmo espírito do "Retroceder Etapa" já existente em
 * Produto Entregue.
 */
export default function PopupReceberValor({
  linha,
  onFechar,
  onConfirmarRecebimento,
  onReverterParaEmAberto,
}: {
  linha: LinhaFinanceiro;
  onFechar: () => void;
  onConfirmarRecebimento: (dataRecebimento: string) => Promise<void>;
  onReverterParaEmAberto: () => Promise<void>;
}) {
  const [dataRecebimento, setDataRecebimento] = useState(linha.dataRecebimento ?? hojeIso());
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const jaRecebido = linha.status === "Vlr. Recebido";
  const valorTotal = (linha.nfMaoDeObraValor ?? 0) + (linha.nfPecasValor ?? 0);

  async function confirmar() {
    if (!dataRecebimento) {
      setErro("Informe a data de recebimento.");
      return;
    }
    setProcessando(true);
    setErro(null);
    try {
      await onConfirmarRecebimento(dataRecebimento);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar o recebimento.");
      setProcessando(false);
    }
  }

  async function reverter() {
    setProcessando(true);
    setErro(null);
    try {
      await onReverterParaEmAberto();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reverter esse lançamento.");
      setProcessando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !processando && onFechar()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Wallet size={18} style={{ color: "var(--accent2)" }} />
            {jaRecebido ? "Valor recebido" : "Confirmar recebimento"}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={processando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-lg border p-3 mb-4 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Valor total da NF</span>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>

        {jaRecebido ? (
          <>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              Esse lançamento já está marcado como recebido, com data de{" "}
              <strong style={{ color: "var(--ink)" }}>
                {new Date(`${linha.dataRecebimento}T00:00:00`).toLocaleDateString("pt-BR")}
              </strong>
              .
            </p>
            {erro && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onFechar}
                disabled={processando}
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={reverter}
                disabled={processando}
                className="inline-flex items-center gap-2 rounded-lg text-sm font-medium px-4 py-2.5 border transition disabled:opacity-60"
                style={{ borderColor: "#f59e0b", color: "#f59e0b" }}
              >
                {processando ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                Reverter p/ Em Aberto
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Data de recebimento
            </label>
            <input
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
              disabled={processando}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition mb-3"
              style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
            />

            {erro && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onFechar}
                disabled={processando}
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={processando}
                className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
                style={{ background: "#16a34a" }}
              >
                {processando ? <Loader2 size={15} className="animate-spin" /> : <CalendarCheck2 size={15} />}
                {processando ? "Confirmando..." : "Confirmar recebimento"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
