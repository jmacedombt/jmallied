"use client";

import { AlertTriangle, X } from "lucide-react";

// Popup genérico de aviso — só informa algo bloqueante, sem ação de
// confirmar (um único botão de fechar). Diferente do PopupConfirmar
// (que sempre pede uma decisão entre Cancelar/Confirmar).
export default function PopupAviso({
  titulo,
  mensagem,
  onFechar,
}: {
  titulo: string;
  mensagem: React.ReactNode;
  onFechar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
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

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
