"use client";

import { useState } from "react";
import { Loader2, Save, X, XCircle } from "lucide-react";

export type AparelhoOqc = {
  id: string;
  trade_allied: string;
  os_reparadora?: string | null;
};

// Pop-up de "OQC FAIL" individual — aberto pelo ícone de reprovação de
// qualidade em "OQC - Controle de Qualidade". Diferente do Reprovar
// (que tem justificativa padrão pré-preenchida), aqui o motivo é sempre
// digitado na hora — cada falha de qualidade tem uma causa diferente
// (peça, cosmético, funcional etc), não faz sentido um texto padrão.
// Salvar grava o motivo e volta o aparelho pra "6 - Ag. Reparo".
export default function PopupOqcFail({
  aparelho,
  onFechar,
  onReprovado,
}: {
  aparelho: AparelhoOqc;
  onFechar: () => void;
  onReprovado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const texto = motivo.trim();
    if (!texto) {
      setErro("Informe o motivo da reprovação no OQC.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/oqc-fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: texto }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível registrar o OQC FAIL.");
        setSalvando(false);
        return;
      }
      onReprovado();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !salvando && onFechar()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <XCircle size={18} style={{ color: "#ef4444" }} />
            OQC FAIL
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          {aparelho.trade_allied}
          {aparelho.os_reparadora && <> · OS Reparadora {aparelho.os_reparadora}</>} volta pra{" "}
          <strong style={{ color: "var(--ink)" }}>6 - Ag. Reparo</strong>.
        </p>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Motivo da reprovação
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Ex: risco no visor, botão não responde, tampa mal encaixada..."
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition resize-none mb-4"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !motivo.trim()}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "#ef4444" }}
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? "Salvando..." : "Salvar OQC FAIL"}
          </button>
        </div>
      </div>
    </div>
  );
}
