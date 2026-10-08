"use client";

import { useState } from "react";
import { CalendarCheck2, Loader2, Wallet, X } from "lucide-react";
import { hojeIso, ROTULO_TIPO_NOTA, type NotaFinanceiro } from "@/lib/financeiro";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Baixa em massa (pedido explícito, 07/10/2026): confirma o recebimento
 * de várias notas fiscais selecionadas na tabela do Financeiro de uma
 * vez, com uma única data de recebimento.
 */
export default function PopupBaixaEmMassa({
  notas,
  onFechar,
  onConfirmar,
}: {
  notas: NotaFinanceiro[];
  onFechar: () => void;
  onConfirmar: (dataRecebimento: string) => Promise<void>;
}) {
  const [dataRecebimento, setDataRecebimento] = useState(hojeIso());
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = notas.reduce((soma, n) => soma + (n.valor ?? 0), 0);

  async function confirmar() {
    if (!dataRecebimento) {
      setErro("Informe a data de recebimento.");
      return;
    }
    setProcessando(true);
    setErro(null);
    try {
      await onConfirmar(dataRecebimento);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível dar baixa nas notas selecionadas.");
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
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Wallet size={18} style={{ color: "var(--accent2)" }} />
            Baixa em massa
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

        <div className="rounded-lg border mb-4 text-sm max-h-56 overflow-y-auto" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          {notas.map((n) => (
            <div key={n.chave} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
              <span style={{ color: "var(--muted)" }}>
                NF {ROTULO_TIPO_NOTA[n.tipo]} <strong style={{ color: "var(--ink)" }}>{n.numero}</strong>
              </span>
              <span style={{ color: "var(--ink)" }}>{formatarReal(n.valor ?? 0)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm mb-4">
          <span style={{ color: "var(--muted)" }}>
            {notas.length} {notas.length === 1 ? "nota selecionada" : "notas selecionadas"}
          </span>
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            {formatarReal(total)}
          </span>
        </div>

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

        {erro && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>}

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
      </div>
    </div>
  );
}
