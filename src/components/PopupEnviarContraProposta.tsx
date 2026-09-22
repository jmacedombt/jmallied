"use client";

import { useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";
import { type ResumoContraProposta } from "@/lib/orcamentos";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Pop-up de envio da Contra Proposta (Ag. Contra Proposta > Enviar
// Contra Proposta) — reescrito por completo (pedido explícito): não manda
// mais e-mail nem move pra "4 - Ag. Resposta de Reorçamento". Confirmando,
// o servidor gera a planilha final (mesmo formato do arquivo de aprovação
// da Allied, combinando aprovados inicialmente + Contra Proposta aceita +
// recusada — ver prepararGeracaoContraProposta), move cada aparelho pra
// "5 - Ag. Peças" ou "8 - Orçamento Reprovado", registra no histórico
// "Contra Propostas" e devolve o arquivo, baixado direto aqui.
export default function PopupEnviarContraProposta({
  loteNf,
  quantidade,
  resumo,
  onFechar,
  onEnviado,
}: {
  loteNf: string;
  quantidade: number;
  resumo: ResumoContraProposta;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/enviar-contra-proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nf_remessa_allied: loteNf }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.error || "Não foi possível gerar a planilha da Contra Proposta.");
        setEnviando(false);
        return;
      }
      const disposicao = res.headers.get("Content-Disposition") ?? "";
      const nomeArquivo = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? `Contra_Proposta_${loteNf}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onEnviado();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Send size={18} style={{ color: "var(--accent2)" }} />
            Enviar Contra Proposta
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Lote (NF Remessa) <strong style={{ color: "var(--ink)" }}>{loteNf}</strong> — {quantidade} aparelho(s)
          decidido(s). Ao confirmar, a planilha final (mesmo formato do arquivo de aprovação da Allied) é gerada e
          baixada aqui — os aprovados vão pra 5 - Ag. Peças, os recusados pra 8 - Orçamento Reprovado. Aparelhos desse
          lote que já estavam em 8 - Orçamento Reprovado também entram, no final da planilha (só informativo).
        </p>

        <div className="rounded-xl border p-4 space-y-1.5 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Mão de obra total</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(resumo.maoDeObra)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Venda de peças (total)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(resumo.vendaTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Total Venda</span>
            <strong style={{ color: "var(--accent2)" }}>{formatarReal(resumo.vendaTotalPecas + resumo.maoDeObra)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink)" }}>Lucro de Peças</span>
            <strong style={{ color: corPercentualLucro(resumo.percLucroPecas) }}>
              {formatarReal(resumo.lucroLiquidoPeca)} ({formatarPercentual(resumo.percLucroPecas)})
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink)" }}>% Lucro Total</span>
            <strong style={{ color: "var(--ink)" }}>{formatarPercentual(resumo.percLucroTotal)}</strong>
          </div>
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {enviando ? "Gerando..." : "Confirmar e baixar"}
          </button>
        </div>
      </div>
    </div>
  );
}
