"use client";

import { useMemo, useState } from "react";

type PontoPeriodo = { periodo: string; quantidade: number };

type Agrupamento = "mes" | "semana" | "ano";

const OPCOES: { valor: Agrupamento; label: string }[] = [
  { valor: "mes", label: "Mês" },
  { valor: "semana", label: "Semana" },
  { valor: "ano", label: "Ano" },
];

function formatarRotulo(periodoIso: string, agrupamento: Agrupamento): string {
  const d = new Date(`${periodoIso}T00:00:00`);
  if (agrupamento === "ano") return String(d.getFullYear());
  if (agrupamento === "semana") {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

const ALTURA = 160;
const LARGURA_BARRA = 18;
const GAP = 6;

export default function GraficoPecasPorPeriodo({
  porMes,
  porSemana,
  porAno,
}: {
  porMes: PontoPeriodo[];
  porSemana: PontoPeriodo[];
  porAno: PontoPeriodo[];
}) {
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("mes");
  const [hover, setHover] = useState<number | null>(null);

  const dados = agrupamento === "mes" ? porMes : agrupamento === "semana" ? porSemana : porAno;
  const max = useMemo(() => Math.max(1, ...dados.map((d) => d.quantidade)), [dados]);
  const largura = Math.max(dados.length * (LARGURA_BARRA + GAP), 240);

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Peças registradas por período
        </p>
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          {OPCOES.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => {
                setAgrupamento(op.valor);
                setHover(null);
              }}
              className="px-3 py-1.5 text-xs font-medium transition"
              style={
                agrupamento === op.valor
                  ? { background: "var(--surface2)", color: "var(--ink)" }
                  : { color: "var(--muted)" }
              }
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {dados.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
          Nenhum dado importado ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            width={largura}
            height={ALTURA + 28}
            role="img"
            aria-label={`Peças registradas por ${agrupamento}`}
          >
            {dados.map((ponto, i) => {
              const alturaBarra = Math.max(2, (ponto.quantidade / max) * ALTURA);
              const x = i * (LARGURA_BARRA + GAP);
              const y = ALTURA - alturaBarra;
              const emHover = hover === i;
              return (
                <g
                  key={ponto.periodo}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                >
                  <rect x={x} y={0} width={LARGURA_BARRA} height={ALTURA} fill="transparent" />
                  <rect
                    x={x}
                    y={y}
                    width={LARGURA_BARRA}
                    height={alturaBarra}
                    rx={4}
                    fill={emHover ? "#5aa9ff" : "#2f6fed"}
                    opacity={emHover ? 1 : 0.85}
                  />
                  {emHover && (
                    <text
                      x={x + LARGURA_BARRA / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill="var(--ink)"
                    >
                      {ponto.quantidade}
                    </text>
                  )}
                  <text
                    x={x + LARGURA_BARRA / 2}
                    y={ALTURA + 16}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="var(--muted)"
                  >
                    {formatarRotulo(ponto.periodo, agrupamento)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
