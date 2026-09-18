"use client";

import { useState } from "react";
import { FileText, Loader2, Save, X } from "lucide-react";
import { type InfoNotaFiscal } from "@/lib/orcamentos";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Pop-up de lançar (ou corrigir) o Nº NF de "NF Mão de Obra", "NF
 * Peças" ou "NF Retorno" dentro de "Ag. Emissão de Nota Fiscal" —
 * aberto pelos 3 ícones ao lado do Exportar (ver PainelAgEmissaoNf.tsx)
 * e, pra corrigir depois, também de dentro do detalhe de um aparelho já
 * em "Produto Entregue" (ver PopupAtendimentoPecas.tsx). O `titulo` já
 * vem pronto ("NF Mão de Obra" | "NF Peças" | "NF Retorno" — pedido
 * explícito) e o `escopo` só explica pra quem preenche o que aquele
 * número vai valer (todo o bloco ou só aquele lote).
 *
 * Só pede o Nº da NF — nunca um valor digitado à mão (pedido
 * explícito): NF Mão de Obra/NF Peças levam o total já calculado
 * automaticamente (`valorAutomatico`, mostrado só pra conferência); NF
 * Retorno não tem valor nenhum (`valorAutomatico` omitido).
 */
export default function PopupNfEmissao({
  titulo,
  escopo,
  valorInicial,
  valorAutomatico,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  escopo: string;
  valorInicial: InfoNotaFiscal | null;
  /** quando vem preenchido, mostra esse total (só leitura) e é ele que
   * vai salvo — nunca um valor digitado. Omitido = NF sem valor (Retorno). */
  valorAutomatico?: number;
  onFechar: () => void;
  onSalvar: (info: InfoNotaFiscal) => Promise<void>;
}) {
  const [numero, setNumero] = useState(valorInicial?.numero ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const numeroLimpo = numero.trim();
    if (!numeroLimpo) {
      setErro("Informe o Nº da NF.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ numero: numeroLimpo, valor: valorAutomatico ?? valorInicial?.valor ?? 0 });
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

        {valorAutomatico != null && (
          <div className="rounded-lg border px-3 py-2.5 mb-1" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted)" }}>
              Valor (total automático)
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {formatarReal(valorAutomatico)}
            </p>
          </div>
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
