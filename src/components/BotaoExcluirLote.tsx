"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";

/**
 * "Excluir lote" na linha da NF do histórico de Bases > Base Orçamentos
 * (pedido explícito, 27/10/2026) — só aparece pra Administrador/Gerente.
 * Pede pra digitar a NF Remessa pra confirmar; o servidor só exclui se
 * nenhum aparelho saiu de Ag. Abertura (ver api/bases/orcamentos/lotes/[id]).
 */
export default function BotaoExcluirLote({
  loteId,
  nfRemessa,
  aparelhos,
}: {
  loteId: string;
  nfRemessa: string;
  aparelhos: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confere = confirmacao.trim() === nfRemessa.trim();

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    try {
      const res = await fetch(`/api/bases/orcamentos/lotes/${loteId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacao }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível excluir o lote.");
        setExcluindo(false);
        return;
      }
      setAberto(false);
      setExcluindo(false);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setExcluindo(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setConfirmacao("");
          setErro(null);
        }}
        title="Excluir este lote (NF) e todos os aparelhos dele"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition hover:border-[#ef4444]"
        style={{ borderColor: "var(--line)", color: "#ef4444" }}
      >
        <Trash2 size={13} />
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !excluindo && setAberto(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <Trash2 size={17} style={{ color: "#ef4444" }} /> Excluir lote {nfRemessa}
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={excluindo}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              Vai apagar <strong style={{ color: "var(--ink)" }}>{aparelhos} aparelho(s)</strong> dessa NF, a linha do
              histórico e os arquivos guardados. <strong style={{ color: "#ef4444" }}>Não tem como desfazer.</strong> Só é
              permitido se nenhum aparelho saiu de Ag. Abertura.
            </p>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Para confirmar, digite a NF Remessa: <strong style={{ color: "var(--ink)" }}>{nfRemessa}</strong>
            </label>
            <input
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={excluindo}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none mb-3"
              style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
            />
            {erro && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={excluindo}
                className="rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={excluir}
                disabled={!confere || excluindo}
                className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#dc2626" }}
              >
                {excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {excluindo ? "Excluindo..." : "Excluir lote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
