"use client";

import { AlertTriangle, X } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

export type FalhaOqcHistorico = { motivo: string | null; avaliado_em: string };

// Pop-up aberto ao clicar na tag "OQC FAIL xN" (ver PainelAgReparo.tsx)
// — mostra o histórico de motivos de reprovação no OQC desse aparelho,
// mais recente primeiro. Só leitura.
export default function PopupHistoricoOqc({
  tradeAllied,
  osReparadora,
  historico,
  onFechar,
}: {
  tradeAllied: string;
  osReparadora?: string | null;
  historico: FalhaOqcHistorico[];
  onFechar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
            Histórico de OQC FAIL
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
          {tradeAllied}
          {osReparadora && <> · OS Reparadora {osReparadora}</>} · {historico.length} reprovação(ões) no OQC
        </p>

        <div className="space-y-2.5 max-h-80 overflow-y-auto">
          {historico.map((h, i) => (
            <div
              key={i}
              className="rounded-lg border px-3 py-2.5"
              style={{ borderColor: "rgba(239, 68, 68, 0.35)", background: "rgba(239, 68, 68, 0.06)" }}
            >
              <p className="text-[11px] font-medium mb-1" style={{ color: "#ef4444" }}>
                {formatarDataHoraBrasilia(h.avaliado_em)}
              </p>
              <p className="text-sm" style={{ color: "var(--ink)" }}>
                {h.motivo || "(sem motivo registrado)"}
              </p>
            </div>
          ))}
          {historico.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>
              Nenhuma reprovação registrada.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end mt-4">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
