"use client";

import { useState } from "react";
import { FileText, Loader2, Save, X } from "lucide-react";
import { type InfoNotaFiscal } from "@/lib/orcamentos";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Pop-up de lançar (ou corrigir) o Nº NF + Valor de "NF Mão de Obra",
 * "NF Peças" ou "NF Retorno" dentro de "Ag. Emissão de Nota Fiscal" —
 * aberto pelos 3 ícones ao lado do Exportar (ver PainelAgEmissaoNf.tsx)
 * e, pra corrigir depois, também de dentro do detalhe de um aparelho já
 * em "Produto Entregue" (ver PopupAtendimentoPecas.tsx). O `titulo` já
 * vem pronto ("NF Mão de Obra" | "NF Peças" | "NF Retorno" — pedido
 * explícito) e o `escopo` só explica pra quem preenche o que aquele
 * número vai valer (todo o bloco ou só aquele lote).
 */
export default function PopupNfEmissao({
  titulo,
  escopo,
  valorInicial,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  escopo: string;
  valorInicial: InfoNotaFiscal | null;
  onFechar: () => void;
  onSalvar: (info: InfoNotaFiscal) => Promise<void>;
}) {
  const [numero, setNumero] = useState(valorInicial?.numero ?? "");
  const [valorTexto, setValorTexto] = useState(
    valorInicial ? valorInicial.valor.toFixed(2).replace(".", ",") : ""
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const numeroLimpo = numero.trim();
    if (!numeroLimpo) {
      setErro("Informe o Nº da NF.");
      return;
    }
    const valorNumerico = Number(valorTexto.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
      setErro("Informe um valor válido.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ numero: numeroLimpo, valor: valorNumerico });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar essa NF.");
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
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <FileText size={18} style={{ color: "var(--accent2)" }} />
            {titulo}
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
          {escopo}
        </p>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Nº NF
        </label>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          disabled={salvando}
          autoFocus
          placeholder="Ex.: 123456"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-3"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Valor
        </label>
        <input
          value={valorTexto}
          onChange={(e) => setValorTexto(e.target.value)}
          disabled={salvando}
          inputMode="decimal"
          placeholder="Ex.: 350,00"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-1"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />
        {Number.isFinite(Number(valorTexto.replace(/\./g, "").replace(",", "."))) && valorTexto.trim() !== "" && (
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            {formatarReal(Number(valorTexto.replace(/\./g, "").replace(",", ".")))}
          </p>
        )}

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 mt-2">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-3">
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
            onClick={salvar}
            disabled={salvando || !numero.trim()}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "var(--accent2)" }}
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
