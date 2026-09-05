"use client";

import { useState } from "react";
import { Ban, Loader2, Lock, Save, Unlock, X } from "lucide-react";
import { MOTIVO_REPROVA_PADRAO } from "@/lib/orcamentos";

// Pop-up de reprovar VÁRIOS orçamentos de uma vez (seleção múltipla em
// 2 - Ag. Análise) — mesma interação do PopupReprovarOrcamento (um só
// orçamento): justificativa padrão vem bloqueada (cores de "bloqueado"),
// marcar "não é essa a justificativa" destrava pra editar (cores mudam),
// e salvar (disquete) aplica a MESMA justificativa a todos os
// selecionados de uma vez, avançando todos pra "8 - Orçamento
// Reprovado". Quem chama (PainelAgAnalise) é quem faz a chamada à API e
// a animação de saída das linhas — esse componente só cuida do texto.
export default function PopupReprovarOrcamentoLote({
  quantidade,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: {
  quantidade: number;
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: (motivo: string) => void;
}) {
  const [justificativa, setJustificativa] = useState(MOTIVO_REPROVA_PADRAO);
  const [editavel, setEditavel] = useState(false);

  function alternarEditavel(marcado: boolean) {
    setEditavel(marcado);
    if (!marcado) setJustificativa(MOTIVO_REPROVA_PADRAO);
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
            <Ban size={18} style={{ color: "#ef4444" }} />
            Recusar orçamentos selecionados
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
          <strong style={{ color: "var(--ink)" }}>{quantidade}</strong> orçamento(s) selecionado(s) vão pra{" "}
          <strong style={{ color: "var(--ink)" }}>8 - Orçamento Reprovado</strong>, todos com a mesma justificativa.
        </p>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Justificativa
        </label>
        <div className="relative mb-3">
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            readOnly={!editavel}
            rows={3}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition resize-none"
            style={
              editavel
                ? {
                    background: "var(--surface2)",
                    borderColor: "var(--accent2)",
                    color: "var(--ink)",
                    cursor: "text",
                  }
                : {
                    background: "rgba(239, 68, 68, 0.06)",
                    borderColor: "rgba(239, 68, 68, 0.35)",
                    color: "var(--muted)",
                    cursor: "not-allowed",
                  }
            }
          />
          <span
            className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={
              editavel
                ? { background: "var(--accent-glow)", color: "var(--accent2)" }
                : { background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }
            }
          >
            {editavel ? (
              <>
                <Unlock size={10} /> Editável
              </>
            ) : (
              <>
                <Lock size={10} /> Bloqueado
              </>
            )}
          </span>
        </div>

        <label className="inline-flex items-center gap-2 text-xs mb-4 cursor-pointer" style={{ color: "var(--ink)" }}>
          <input
            type="checkbox"
            checked={editavel}
            onChange={(e) => alternarEditavel(e.target.checked)}
            disabled={salvando}
          />
          Não é essa a justificativa
        </label>

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
            onClick={() => onSalvar(justificativa.trim())}
            disabled={salvando || !justificativa.trim()}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "#ef4444" }}
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? "Salvando..." : `Salvar e recusar ${quantidade}`}
          </button>
        </div>
      </div>
    </div>
  );
}
