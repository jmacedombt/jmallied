"use client";

import { useState } from "react";
import { Loader2, Save, X, XCircle } from "lucide-react";

// Pop-up flutuante pra registrar o motivo da recusa de uma Contra
// Proposta (botão "Reprovado", tanto na lista de Ag. Contra Proposta
// quanto no pop-up de ajuste peça a peça) — campo livre + ícone de
// disquete pra salvar (pedido explícito). Chama direto a rota de decisão
// (decidir-contra-proposta); quem abre só precisa do id do aparelho e do
// callback de sucesso.
export default function PopupMotivoReprovaContraProposta({
  aparelhoId,
  trade,
  osReparadora,
  motivoInicial = "",
  onFechar,
  onReprovado,
}: {
  aparelhoId: string;
  trade?: string;
  osReparadora?: string | null;
  motivoInicial?: string;
  onFechar: () => void;
  onReprovado: () => void;
}) {
  const [motivo, setMotivo] = useState(motivoInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const texto = motivo.trim();
    if (!texto) {
      setErro("Informe o motivo da recusa.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelhoId}/decidir-contra-proposta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao: "Reprovado", motivo: texto }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível registrar a recusa.");
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
            Reprovar Contra Proposta
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

        {(trade || osReparadora) && (
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            {trade}
            {osReparadora && <> · OS Reparadora {osReparadora}</>}
          </p>
        )}

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Motivo da recusa
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Explique por que a Contra Proposta da Allied foi recusada..."
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition resize-none mb-3"
          style={{ background: "var(--surface2)", borderColor: "var(--accent2)", color: "var(--ink)" }}
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
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
