"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";

// Ação separada do "Gerar relatório" (que continua podendo rodar livre
// como rascunho, sem travar nada). Só essa aqui grava data/hora oficial
// de envio ao cliente, peça a peça — a partir daí, um Recalcular BID que
// mudaria alguma dessas peças passa a pedir confirmação explícita.
export default function BotaoMarcarBidEnviado() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function marcarComoEnviado() {
    setEnviando(true);
    setErro(null);
    setSucesso(null);
    try {
      const res = await fetch("/api/bases/bid/marcar-enviado", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível marcar o BID como enviado.");
      } else {
        setSucesso(`${data.quantidadeMarcada} peça(s) marcada(s) como enviada(s) ao cliente agora.`);
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setEnviando(false);
    setConfirmando(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={enviando}
        title="Grava data/hora de envio e trava o valor atual de cada peça — mudanças futuras na Base Peças vão exigir confirmação antes de aplicar"
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition hover:border-[var(--accent2)] disabled:opacity-50"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
      >
        <Send size={15} />
        Marcar como enviado
      </button>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">{erro}</p>
      )}
      {sucesso && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mt-3 inline-flex items-center gap-1.5">
          <CheckCircle2 size={14} />
          {sucesso}
        </p>
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setConfirmando(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--ink)" }}>
              Marcar BID como enviado ao cliente?
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Vai gravar data e hora agora, e travar o valor atual de Custo Peça (Allied) de cada peça calculada. A
              partir disso, qualquer recálculo que mudaria o valor de uma peça já enviada vai exigir confirmação
              antes de aplicar.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={marcarComoEnviado}
                disabled={enviando}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {enviando ? "Marcando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
