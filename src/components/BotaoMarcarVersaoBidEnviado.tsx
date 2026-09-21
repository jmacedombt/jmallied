"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

/**
 * Ação por LINHA do histórico do Relatório BID (pedido explícito,
 * diferente do botão "Marcar BID como enviado" que já existe na mesma
 * tela — esse aqui só carimba a linha, sem travar preço de peça
 * nenhuma). Marcada, a linha fica em verde e passa a aparecer pro login
 * ALLIED (ver /bases/bid/versoes-enviadas). Dá pra reverter também, caso
 * marque errado.
 */
export default function BotaoMarcarVersaoBidEnviado({ id, enviadoEm }: { id: string; enviadoEm: string | null }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<"enviar" | "reverter" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(enviado: boolean) {
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/bases/bid/relatorio/${id}/marcar-enviado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enviado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error ?? "Não foi possível atualizar.");
        setProcessando(false);
        return;
      }
      setConfirmando(null);
      setProcessando(false);
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setProcessando(false);
    }
  }

  if (enviadoEm) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "rgba(34, 197, 94, 0.14)", color: "#22c55e" }}
          title={`Enviado em ${formatarDataHoraBrasilia(enviadoEm)}`}
        >
          <CheckCircle2 size={12} />
          Enviado
        </span>
        <button
          type="button"
          onClick={() => setConfirmando("reverter")}
          title="Reverter (essa versão deixa de aparecer pro login Allied)"
          className="text-xs underline decoration-dotted transition hover:opacity-80"
          style={{ color: "var(--muted)" }}
        >
          reverter
        </button>

        {confirmando === "reverter" && (
          <PopupConfirmar
            titulo="Reverter versão enviada?"
            mensagem="Essa versão do Relatório BID deixa de aparecer pro login Allied. Continua salva no histórico normalmente."
            rotuloConfirmar="Reverter"
            carregando={processando}
            erro={erro}
            onConfirmar={() => alterar(false)}
            onFechar={() => !processando && setConfirmando(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando("enviar")}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)]"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
      >
        <Send size={13} />
        Marcar como enviado
      </button>

      {confirmando === "enviar" && (
        <PopupConfirmar
          titulo="Marcar essa versão como enviada?"
          mensagem="Essa versão do Relatório BID passa a aparecer pro login Allied, com data e hora do envio."
          rotuloConfirmar="Marcar como enviado"
          carregando={processando}
          erro={erro}
          onConfirmar={() => alterar(true)}
          onFechar={() => !processando && setConfirmando(null)}
        />
      )}
    </>
  );
}
