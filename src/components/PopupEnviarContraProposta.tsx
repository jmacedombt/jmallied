"use client";

import { useState } from "react";
import { Download, Loader2, Send, X } from "lucide-react";
import { type ResumoContraProposta } from "@/lib/orcamentos";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Pop-up de envio da Contra Proposta (Ag. Contra Proposta > Enviar
// Contra Proposta) — resumo simplificado (mão de obra total, peça total,
// % lucro) pedido pelo usuário, com opção de baixar o Excel antes de
// mandar de verdade (mesmo formato do envio original, mesma trava de
// "todos ajustados" revalidada no servidor).
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
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoEmail, setAvisoEmail] = useState<string | null>(null);

  async function baixarPreview() {
    setGerandoPreview(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/enviar-contra-proposta/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nf_remessa_allied: loteNf }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Não foi possível gerar o preview do arquivo.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `preview-contra-proposta-${loteNf}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o preview.");
    } finally {
      setGerandoPreview(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/enviar-contra-proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nf_remessa_allied: loteNf }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível enviar a Contra Proposta.");
        setEnviando(false);
        return;
      }
      if (data?.email?.erro) setAvisoEmail(`O lote avançou, mas o e-mail não foi enviado: ${data.email.erro}`);
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
          Lote (NF Remessa) <strong style={{ color: "var(--ink)" }}>{loteNf}</strong> — {quantidade} aparelho(s). Ao
          enviar, todos avançam pra 4 - Ag. Resposta de Reorçamento e o Excel é mandado por e-mail.
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
            <span style={{ color: "var(--ink)" }}>% Lucro Total</span>
            <strong style={{ color: "var(--ink)" }}>{formatarPercentual(resumo.percLucroTotal)}</strong>
          </div>
        </div>

        {avisoEmail && (
          <p className="text-xs mt-3" style={{ color: "#b45309" }}>
            {avisoEmail}
          </p>
        )}
        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={baixarPreview}
            disabled={gerandoPreview || enviando}
            title="Gera o Excel exatamente como ele sairia se você enviar agora — não grava nem manda nada."
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
          >
            {gerandoPreview ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {gerandoPreview ? "Gerando..." : "Preview (Excel)"}
          </button>

          <div className="flex items-center gap-2">
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
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
