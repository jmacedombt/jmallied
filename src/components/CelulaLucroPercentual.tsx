"use client";

import { useState } from "react";
import { Check, Copy, Gauge, X } from "lucide-react";

export type BaseCalculoLucro = {
  custoTotalPecas: number;
  impostoTotalPecas: number;
  vendaTotalPecas: number;
  maoDeObra: number;
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

// Faixas de cor do % Lucro Total, conforme definido pelo Rafael: abaixo
// de 20% é alerta (vermelho), 20–30% atenção (laranja), 30–40% saudável
// (verde), acima de 40% ótimo (azul).
export function corPercentualLucro(percentual: number): string {
  if (percentual < 20) return "#ef4444";
  if (percentual < 30) return "#f97316";
  if (percentual < 40) return "#22c55e";
  return "#3b82f6";
}

function textoResumo(base: BaseCalculoLucro): string {
  return [
    `Custo das peças: ${formatarReal(base.custoTotalPecas)}`,
    `Imposto (ICMS): ${formatarReal(base.impostoTotalPecas)}`,
    `Venda de peças: ${formatarReal(base.vendaTotalPecas)}`,
    `Mão de obra: ${formatarReal(base.maoDeObra)}`,
    "",
    `Lucro Total = Mão de obra + Venda de Peças − Custo das Peças − Imposto`,
    `Lucro Total = ${formatarReal(base.lucroTotal)}`,
    "",
    `% Lucro Peças = (Venda − Custo) ÷ Venda`,
    `% Lucro Peças = ${formatarPercentual(base.percLucroPecas)}`,
    "",
    `% Lucro Total = ((Venda + Mão de obra) − Custo) ÷ (Venda + Mão de obra)`,
    `% Lucro Total = ${formatarPercentual(base.percLucroTotal)}`,
  ].join("\n");
}

function FormulaCalculada({
  label,
  formula,
  valor,
  corValor,
}: {
  label: string;
  formula: string;
  valor: string;
  corValor?: string;
}) {
  return (
    <div>
      <div className="flex justify-between gap-4">
        <span style={{ color: "var(--ink)" }}>{label}</span>
        <strong style={{ color: corValor ?? "var(--ink)" }}>{valor}</strong>
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        {formula}
      </p>
    </div>
  );
}

// Célula da coluna "Lucro Total %": mostra o percentual colorido pela
// faixa; ao CLICAR (não mais ao passar o mouse — o balão flutuante
// ficava cortado/sobreposto perto da borda da tela) abre um pop-up
// central com o cálculo completo e um botão de copiar. Clicar fora do
// pop-up fecha.
export default function CelulaLucroPercentual({ base }: { base: BaseCalculoLucro }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cor = corPercentualLucro(base.percLucroTotal);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoResumo(base));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold cursor-pointer"
        style={{ color: cor, background: `${cor}1a`, border: `1px solid ${cor}55` }}
      >
        {formatarPercentual(base.percLucroTotal)}
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={(e) => {
            e.stopPropagation();
            setAberto(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <Gauge size={16} style={{ color: cor }} />
                Cálculo do Lucro
              </h3>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="rounded-xl border p-3 text-xs space-y-2"
              style={{ background: "var(--surface2)", borderColor: "var(--line)" }}
            >
              <div className="space-y-1">
                <p className="flex justify-between gap-4">
                  <span style={{ color: "var(--muted)" }}>Custo das peças</span>
                  <strong style={{ color: "var(--ink)" }}>{formatarReal(base.custoTotalPecas)}</strong>
                </p>
                <p className="flex justify-between gap-4">
                  <span style={{ color: "var(--muted)" }}>Imposto (ICMS)</span>
                  <strong style={{ color: "var(--ink)" }}>{formatarReal(base.impostoTotalPecas)}</strong>
                </p>
                <p className="flex justify-between gap-4">
                  <span style={{ color: "var(--muted)" }}>Venda de peças</span>
                  <strong style={{ color: "var(--ink)" }}>{formatarReal(base.vendaTotalPecas)}</strong>
                </p>
                <p className="flex justify-between gap-4">
                  <span style={{ color: "var(--muted)" }}>Mão de obra</span>
                  <strong style={{ color: "var(--ink)" }}>{formatarReal(base.maoDeObra)}</strong>
                </p>
              </div>

              <div className="border-t pt-2 space-y-2" style={{ borderColor: "var(--line)" }}>
                <FormulaCalculada
                  label="Lucro Total"
                  formula="Mão de obra + Venda de Peças − Custo − Imposto"
                  valor={formatarReal(base.lucroTotal)}
                />
                <FormulaCalculada
                  label="% Lucro Peças"
                  formula="(Venda − Custo) ÷ Venda"
                  valor={formatarPercentual(base.percLucroPecas)}
                />
                <FormulaCalculada
                  label="% Lucro Total"
                  formula="((Venda + Mão de obra) − Custo) ÷ (Venda + Mão de obra)"
                  valor={formatarPercentual(base.percLucroTotal)}
                  corValor={cor}
                />
              </div>
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
      )}
    </>
  );
}
