"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Undo2, X } from "lucide-react";

// Pop-up de "Voltar pro Status Anterior" em lote, em "3 - Ag. Resposta
// de Orçamento" (pedido explícito, 25/09/2026) — só Administrador (ver
// podeVoltarLoteAgRespostaOrcamento). Volta os aparelhos selecionados
// (todos "Aguardando", de um único lote/NF Remessa) pra Validação de
// Orçamentos; opcionalmente também exclui o registro desse lote em
// "Orçamentos Enviados" (linha do histórico + arquivo no Storage) — ver
// api/operacional/orcamentos/voltar-lote-resposta-orcamento.
export default function PopupVoltarLoteRespostaOrcamento({
  quantidade,
  nfRemessa,
  ids,
  onFechar,
  onVoltado,
}: {
  quantidade: number;
  nfRemessa: string;
  ids: string[];
  onFechar: () => void;
  onVoltado: () => void;
}) {
  const [excluirRegistroEnvio, setExcluirRegistroEnvio] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/voltar-lote-resposta-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, excluirRegistroEnvio }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível voltar o lote de etapa.");
        setSalvando(false);
        return;
      }
      onVoltado();
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
            <Undo2 size={18} style={{ color: "var(--accent2)" }} />
            Voltar pro status anterior
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
          <strong style={{ color: "var(--ink)" }}>{quantidade}</strong> aparelho(s) do lote{" "}
          <strong style={{ color: "var(--ink)" }}>{nfRemessa}</strong> vão voltar de{" "}
          <strong style={{ color: "var(--ink)" }}>3 - Ag. Resposta de Orçamento</strong> pra{" "}
          <strong style={{ color: "var(--ink)" }}>Validação de Orçamentos</strong>.
        </p>

        <label
          className="flex items-start gap-2 text-xs mb-4 cursor-pointer rounded-lg border px-3 py-2.5"
          style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={excluirRegistroEnvio}
            onChange={(e) => setExcluirRegistroEnvio(e.target.checked)}
            disabled={salvando}
          />
          <span>
            Também excluir o registro desse lote em <strong>Orçamentos Enviados</strong> (apaga o histórico e o
            arquivo Excel enviado — não dá pra desfazer).
          </span>
        </label>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
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
            onClick={confirmar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
            {salvando ? "Voltando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
