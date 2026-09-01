"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import PainelBipagem from "@/components/PainelBipagem";

// Abre sozinho ao entrar na tela de Ag. Triagem (modo contínuo: não
// fecha depois de cada etiqueta impressa — o operador vai bipando um
// aparelho atrás do outro). Dá pra fechar pra ver a lista por trás, e
// reabrir depois pelo botão flutuante.
export default function PopupBipagemTriagem() {
  const [aberto, setAberto] = useState(true);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-2xl transition hover:scale-105"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        <Printer size={16} />
        Bipar / Imprimir etiqueta
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Printer size={18} style={{ color: "var(--accent2)" }} />
            Triagem — imprimir etiqueta
          </h2>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Localiza o aparelho na lista de Ag. Triagem, manda a etiqueta pra impressora e avança pra 2 - Ag. Análise
          automaticamente.
        </p>

        <PainelBipagem modo="triagem" />
      </div>
    </div>
  );
}
