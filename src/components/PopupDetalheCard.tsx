"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export type LinhaDetalheCard = { rotulo: string; valor: string };

// Base de cálculo (todos os lotes juntos) mostrada como contexto extra
// nos cards de Lucro Total / % Lucro Peças / % Lucro Total — em vez de
// criar mais cards na linha de cima, a Mão de obra (que não tem card
// próprio) e os outros 3 valores que compõem a conta aparecem aqui.
export type BaseCalculoResumo = {
  custoTotalPecas: number;
  impostoTotalPecas: number;
  vendaTotalPecas: number;
  maoDeObra: number;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up genérico de "resumo relacionado ao card clicado" — qualquer
// card da linha de totais (Nessa etapa, Quantidade de Peças, Custo,
// Imposto, Venda, Lucro Total, % Lucro Peças, % Lucro Total) abre esse
// mesmo pop-up, só trocando ícone/rótulo/fórmula/linhas. As linhas são
// sempre o valor daquele card quebrado por lote (NF Remessa), pra dar
// contexto de como o total exibido se formou. Fecha clicando fora.
export default function PopupDetalheCard({
  icone: Icone,
  label,
  valorAtual,
  corValor,
  formula,
  baseCalculo,
  linhas,
  onFechar,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icone: React.ComponentType<any>;
  label: string;
  valorAtual: string;
  corValor?: string;
  formula?: string;
  /** só nos cards de Lucro Total / % Lucro Peças / % Lucro Total — mostra
   * Custo, Imposto, Venda e Mão de obra (agregados) como base do cálculo. */
  baseCalculo?: BaseCalculoResumo;
  linhas: LinhaDetalheCard[];
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const linhasBase = baseCalculo
      ? [
          "",
          "Base de cálculo (todos os lotes):",
          `Custo das peças: ${formatarReal(baseCalculo.custoTotalPecas)}`,
          `Imposto (ICMS): ${formatarReal(baseCalculo.impostoTotalPecas)}`,
          `Venda de peças: ${formatarReal(baseCalculo.vendaTotalPecas)}`,
          `Mão de obra: ${formatarReal(baseCalculo.maoDeObra)}`,
        ]
      : [];
    const texto = [
      `${label}: ${valorAtual}`,
      formula ? `Fórmula: ${formula}` : null,
      ...linhasBase,
      "",
      "Por lote (NF Remessa):",
      ...linhas.map((l) => `${l.rotulo}: ${l.valor}`),
    ]
      .filter((l): l is string => l != null)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        e.stopPropagation();
        onFechar();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Icone size={16} style={{ color: corValor ?? "var(--accent2)" }} />
            {label}
          </h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-2xl font-semibold mb-1" style={{ color: corValor ?? "var(--ink)" }}>
          {valorAtual}
        </p>
        {formula && (
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            {formula}
          </p>
        )}

        {baseCalculo && (
          <div
            className="rounded-xl border p-3 mb-3 text-xs space-y-1"
            style={{ background: "var(--surface2)", borderColor: "var(--line)" }}
          >
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Custo das peças</span>
              <strong style={{ color: "var(--ink)" }}>{formatarReal(baseCalculo.custoTotalPecas)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Imposto (ICMS)</span>
              <strong style={{ color: "var(--ink)" }}>{formatarReal(baseCalculo.impostoTotalPecas)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Venda de peças</span>
              <strong style={{ color: "var(--ink)" }}>{formatarReal(baseCalculo.vendaTotalPecas)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Mão de obra</span>
              <strong style={{ color: "var(--ink)" }}>{formatarReal(baseCalculo.maoDeObra)}</strong>
            </p>
          </div>
        )}

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-1.5 font-medium">Lote (NF Remessa)</th>
                <th className="px-3 py-1.5 font-medium text-right">{label}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rotulo} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-1.5 font-mono" style={{ color: "var(--muted)" }}>
                    {l.rotulo}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: "var(--ink)" }}>
                    {l.valor}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-center" style={{ color: "var(--muted)" }}>
                    Nenhum lote nessa etapa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={copiar}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)]"
          style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
        >
          {copiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          Copiar
        </button>
      </div>
    </div>
  );
}
