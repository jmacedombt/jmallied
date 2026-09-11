"use client";

import { useState } from "react";
import { Download, Loader2, Send, X } from "lucide-react";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up de envio da planilha Complementar (4 - Ag. Resposta de
// Reorçamento > Enviar planilha Complementar) — junta TODOS os
// reorçamentos pendentes de envio numa planilha só, não importa o lote
// (NF Remessa) — diferente do resto do sistema, que sempre separa por
// lote (foi assim que o Rafael mandou o modelo real). Preview baixa o
// Excel sem gravar nada; Enviar marca todos como enviados de verdade e
// manda o e-mail.
export default function PopupEnviarReorcamento({
  quantidade,
  valorTotal,
  onFechar,
  onEnviado,
}: {
  quantidade: number;
  valorTotal: number;
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
      const res = await fetch("/api/operacional/orcamentos/enviar-reorcamento/preview", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Não foi possível gerar o preview do arquivo.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "preview-complementar.xlsx";
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
      const res = await fetch("/api/operacional/orcamentos/enviar-reorcamento", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível enviar a planilha Complementar.");
        setEnviando(false);
        return;
      }
      if (data?.email?.erro) {
        setAvisoEmail(`Os reorçamentos foram marcados como enviados, mas o e-mail não foi mandado: ${data.email.erro}`);
      }
      onEnviado();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-full max-w-md rounded-2xl border shadow-2xl p-6" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Send size={18} style={{ color: "var(--accent2)" }} />
            Enviar planilha Complementar
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
          {quantidade} aparelho(s) pendente(s) de envio, de qualquer lote (NF Remessa) — vão todos juntos numa
          planilha só. Ao enviar, o Excel é mandado por e-mail e o botão Aprovar libera pra cada um.
        </p>

        <div className="rounded-xl border p-4 space-y-1.5 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Aparelhos</span>
            <strong style={{ color: "var(--ink)" }}>{quantidade}</strong>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Valor total do reparo</span>
            <strong style={{ color: "var(--accent2)" }}>{formatarReal(valorTotal)}</strong>
          </div>
        </div>

        {avisoEmail && (
          <p className="text-xs mt-3" style={{ color: "#b45309" }}>
            {avisoEmail}
          </p>
        )}
        {erro && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>}

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
