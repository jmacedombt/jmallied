"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

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
    `Lucro Total: ${formatarReal(base.lucroTotal)}`,
    `% Lucro Peças: ${formatarPercentual(base.percLucroPecas)}`,
    `% Lucro Total: ${formatarPercentual(base.percLucroTotal)}`,
  ].join("\n");
}

// Célula da coluna "Lucro Total %": mostra o percentual colorido pela
// faixa e, ao passar o mouse, um balão com toda a base de cálculo desse
// registro (só desse, não do lote inteiro). Clicar fixa o balão aberto
// com um botão de copiar no canto; clicar de novo fecha.
export default function CelulaLucroPercentual({ base }: { base: BaseCalculoLucro }) {
  const [aberto, setAberto] = useState(false);
  const [fixado, setFixado] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  const cor = corPercentualLucro(base.percLucroTotal);

  function calcularPosicao() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ left: Math.max(8, rect.right - 300), top: rect.bottom + 6 });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoResumo(base));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  const mostrar = aberto || fixado;

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => {
        calcularPosicao();
        setAberto(true);
      }}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setFixado((f) => {
            const novo = !f;
            if (novo) calcularPosicao();
            else setAberto(false); // clicou de novo pra "despregar" — some na hora, mesmo com o mouse ainda em cima
            return novo;
          });
        }}
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold cursor-help"
        style={{ color: cor, background: `${cor}1a`, border: `1px solid ${cor}55` }}
      >
        {formatarPercentual(base.percLucroTotal)}
      </button>

      {mostrar && pos && (
        <div
          className="fixed z-[70] rounded-lg border shadow-2xl p-3 text-xs space-y-1.5 min-w-[240px]"
          style={{ left: pos.left, top: pos.top, background: "var(--surface2)", borderColor: "var(--line)" }}
          onMouseLeave={() => setAberto(false)}
        >
          {fixado && (
            <div className="flex items-center justify-end -mt-1 -mr-1 mb-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copiar();
                }}
                title="Copiar"
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/10"
                style={{ color: "var(--muted)" }}
              >
                {copiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>
          )}
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
          <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Lucro Total</span>
              <strong style={{ color: "var(--ink)" }}>{formatarReal(base.lucroTotal)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>% Lucro Peças</span>
              <strong style={{ color: "var(--ink)" }}>{formatarPercentual(base.percLucroPecas)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>% Lucro Total</span>
              <strong style={{ color: cor }}>{formatarPercentual(base.percLucroTotal)}</strong>
            </p>
          </div>
        </div>
      )}
    </span>
  );
}
