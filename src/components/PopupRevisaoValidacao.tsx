"use client";

import { useState } from "react";
import { Check, ClipboardList, Copy, Loader2, PackageCheck, X } from "lucide-react";

export type ResumoValidacao = {
  quantidadeOrcamentos: number;
  quantidadePecas: number;
  custoTotalPecas: number;
  impostoTotalPecas: number;
  maoDeObraTotal: number;
  vendaTotalPecas: number;
  /** venda − custo − imposto, sem misturar mão de obra (bloco de peça). */
  lucroBrutoPeca: number;
  lucroTotal: number;
  percLucroPecas: number;
  percLucroTotal: number;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function linhas(resumo: ResumoValidacao) {
  return [
    { label: "Quantidade de Orçamentos", valor: String(resumo.quantidadeOrcamentos) },
    { label: "Quantidade de Peças", valor: String(resumo.quantidadePecas) },
    { label: "Total Custo de Peças (R$)", valor: formatarReal(resumo.custoTotalPecas) },
    { label: "Total de Imposto (ICMS)", valor: formatarReal(resumo.impostoTotalPecas) },
    { label: "Total Venda de Peças (R$)", valor: formatarReal(resumo.vendaTotalPecas) },
    { label: "Lucro Bruto da Peça (R$)", valor: formatarReal(resumo.lucroBrutoPeca) },
    { label: "Total de Mão de Obra (R$)", valor: formatarReal(resumo.maoDeObraTotal) },
    { label: "Lucro Total (R$)", valor: formatarReal(resumo.lucroTotal), destaque: true },
    { label: "% Lucro Peças (margem sobre venda)", valor: formatarPercentual(resumo.percLucroPecas) },
    { label: "% Lucro Total", valor: formatarPercentual(resumo.percLucroTotal), destaque: true },
  ];
}

function textoResumo(resumo: ResumoValidacao, tituloLote?: string) {
  const cabecalho = tituloLote ? `Validação de Orçamentos — Lote ${tituloLote}` : "Validação de Orçamentos — Revisão";
  return [cabecalho, "", ...linhas(resumo).map((l) => `${l.label}: ${l.valor}`)].join("\n");
}

// Pop-up de revisão consolidada da Validação de Orçamentos. Dois modos:
//  - "revisao": só mostra os totais (do que está filtrado na tela).
//  - "confirmar": mesma coisa, mas com o número do lote em destaque e um
//    botão "Confirmar" que envia o lote inteiro pro próximo passo
//    (3 - Ag. Resposta de Orçamento).
export default function PopupRevisaoValidacao({
  modo,
  loteNf,
  resumo,
  onFechar,
  onConfirmar,
}: {
  modo: "revisao" | "confirmar";
  loteNf?: string;
  resumo: ResumoValidacao;
  onFechar: () => void;
  onConfirmar?: () => Promise<void> | void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoResumo(resumo, modo === "confirmar" ? loteNf : undefined));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  async function confirmar() {
    if (!onConfirmar) return;
    setConfirmando(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar o envio.");
      setConfirmando(false);
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
            {modo === "confirmar" ? (
              <PackageCheck size={18} style={{ color: "var(--accent2)" }} />
            ) : (
              <ClipboardList size={18} style={{ color: "var(--accent2)" }} />
            )}
            {modo === "confirmar" ? "Confirmar envio do lote" : "Revisão consolidada"}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={confirmando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {modo === "confirmar" && (
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Lote (NF Remessa) <strong style={{ color: "var(--ink)" }}>{loteNf}</strong> — ao confirmar, todos os
            aparelhos desse lote avançam de Validação de Orçamentos pra 3 - Ag. Resposta de Orçamento.
          </p>
        )}
        {modo === "revisao" && (
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Totais consolidados do que está sendo exibido agora na tela.
          </p>
        )}

        <div className="rounded-xl border p-4 space-y-1.5 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          {linhas(resumo).map((l) => (
            <div
              key={l.label}
              className={`flex items-center justify-between ${l.destaque ? "pt-1.5 mt-1.5 border-t" : ""}`}
              style={l.destaque ? { borderColor: "var(--line)" } : undefined}
            >
              <span style={{ color: "var(--muted)" }}>{l.label}</span>
              <strong style={{ color: l.destaque ? "var(--accent2)" : "var(--ink)" }}>{l.valor}</strong>
            </div>
          ))}
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
          >
            {copiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            Copiar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={confirmando}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
              style={{ color: "var(--muted)" }}
            >
              {modo === "confirmar" ? "Cancelar" : "Fechar"}
            </button>
            {modo === "confirmar" && (
              <button
                type="button"
                onClick={confirmar}
                disabled={confirmando}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
                style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
              >
                {confirmando ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                Confirmar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
