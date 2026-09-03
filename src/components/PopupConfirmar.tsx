"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";

// Popup genérico de confirmação, usado nas ações mais sensíveis
// (bloquear/desbloquear usuário, resetar senha, e depois nas rotinas
// de confirmação em massa do Ag. Abertura/Ag. Triagem).
export default function PopupConfirmar({
  titulo,
  mensagem,
  rotuloConfirmar = "Confirmar",
  perigo = false,
  carregando = false,
  erro,
  onConfirmar,
  onFechar,
}: {
  titulo: string;
  mensagem: React.ReactNode;
  rotuloConfirmar?: string;
  perigo?: boolean;
  carregando?: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <AlertTriangle size={18} style={{ color: perigo ? "#ef4444" : "var(--accent2)" }} />
            {titulo}
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

        <div className="text-sm mb-5" style={{ color: "var(--muted)" }}>
          {mensagem}
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
            style={{
              background: perigo ? "#dc2626" : "var(--accent)",
              boxShadow: perigo ? undefined : "0 0 30px var(--accent-glow)",
            }}
          >
            {carregando && <Loader2 size={14} className="animate-spin" />}
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
