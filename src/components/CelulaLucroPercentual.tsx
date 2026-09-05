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

const LARGURA_BALAO = 300;
const ALTURA_ESTIMADA_BALAO = 360;

// Célula da coluna "Lucro Total %": mostra o percentual colorido pela
// faixa e, ao passar o mouse, um balão com o cálculo completo desse
// registro (só desse, não do lote inteiro) — cada etapa com a fórmula
// usada, não só o resultado final. Clicar fixa o balão aberto com um
// botão de copiar no canto; clicar de novo fecha. A posição é calculada
// toda vez (com base no espaço livre da tela) pra nunca ficar cortado
// nem sobreposto por outro conteúdo.
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
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const abrirParaCima = espacoAbaixo < ALTURA_ESTIMADA_BALAO && rect.top > espacoAbaixo;
    const top = abrirParaCima
      ? Math.max(8, rect.top - ALTURA_ESTIMADA_BALAO)
      : Math.min(rect.bottom + 6, window.innerHeight - 8);
    const left = Math.min(Math.max(8, rect.right - LARGURA_BALAO), window.innerWidth - LARGURA_BALAO - 8);
    setPos({ left, top });
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
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          {formula}
        </p>
      </div>
    );
  }

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
          className="fixed z-[80] rounded-lg border shadow-2xl p-3 text-xs space-y-2"
          style={{ left: pos.left, top: pos.top, width: LARGURA_BALAO, background: "var(--surface2)", borderColor: "var(--line)" }}
          onMouseLeave={() => setAberto(false)}
        >
          {fixado && (
            <div className="flex items-center justify-end -mt-1 -mr-1">
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
      )}
    </span>
  );
}
