"use client";

import { useMemo, useState } from "react";

type PontoPeriodo = { periodo: string; quantidade: number };

type Agrupamento = "mes" | "semana" | "ano";

const OPCOES: { valor: Agrupamento; label: string }[] = [
  { valor: "mes", label: "Mês" },
  { valor: "semana", label: "Semana" },
  { valor: "ano", label: "Ano" },
];

// quantos pontos (mais recentes) cada agrupamento mostra — "ano" não é
// limitado porque dificilmente uma base acumula mais que uns poucos anos
const JANELA: Record<Agrupamento, number | null> = {
  mes: 12,
  semana: 15,
  ano: null,
};

/** Número da semana ISO-8601 (segunda-feira como início), igual ao que
 * o Postgres usa em date_trunc('week', ...) — por isso bate certinho
 * com o agrupamento que já vem do banco. */
function semanaIso(data: Date): number {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7; // domingo (0) vira 7
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

function formatarRotulo(periodoIso: string, agrupamento: Agrupamento): string {
  const d = new Date(`${periodoIso}T00:00:00`);
  if (agrupamento === "ano") return String(d.getFullYear());
  if (agrupamento === "semana") {
    return `W${semanaIso(d)}`;
  }
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

// sistema de coordenadas do viewBox (unidades abstratas, não pixels) —
// a largura é esticada por preserveAspectRatio="none" pra sempre ocupar
// 100% do espaço disponível, só a altura fica fixa (em px reais)
const VIEWBOX_LARGURA = 1000;
const ALTURA_PX = 240;
const PADDING_TOPO = 40; // espaço pra profundidade 3D + valor acima da barra
const ALTURA_PLOT = 160; // altura máxima que uma barra pode ter
const ALTURA_EIXO = 40; // espaço pro rótulo do período embaixo
const BASELINE = PADDING_TOPO + ALTURA_PLOT;

const CORES = {
  normal: { frente: "#2f6fed", topo: "#7ab0ff", lado: "#1f4fb8" },
  hover: { frente: "#5aa9ff", topo: "#a3cbff", lado: "#2f6fed" },
};

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

  const bruto = agrupamento === "mes" ? porMes : agrupamento === "semana" ? porSemana : porAno;
  const janela = JANELA[agrupamento];
  const dados = janela ? bruto.slice(-janela) : bruto;
  const max = useMemo(() => Math.max(1, ...dados.map((d) => d.quantidade)), [dados]);

  const n = Math.max(dados.length, 1);
  const slot = VIEWBOX_LARGURA / n;
  const gap = slot * 0.28;
  const profundidade = Math.min(slot * 0.22, 16);
  const larguraBarra = Math.max(slot - gap - profundidade, 4);

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
        <svg
          width="100%"
          height={ALTURA_PX}
          viewBox={`0 0 ${VIEWBOX_LARGURA} ${PADDING_TOPO + ALTURA_PLOT + ALTURA_EIXO}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Peças registradas por ${agrupamento}`}
        >
          <defs>
            <filter id="sombraBarra3d" x="-40%" y="-40%" width="180%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.28" />
            </filter>
            <filter id="sombraChao3d" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          {dados.map((ponto, i) => {
            const alturaBarra = Math.max(3, (ponto.quantidade / max) * ALTURA_PLOT);
            const x = i * slot + gap / 2;
            const y = BASELINE - alturaBarra;
            const emHover = hover === i;
            const cor = emHover ? CORES.hover : CORES.normal;

            const topoPontos = [
              `${x},${y}`,
              `${x + profundidade},${y - profundidade}`,
              `${x + larguraBarra + profundidade},${y - profundidade}`,
              `${x + larguraBarra},${y}`,
            ].join(" ");

            const ladoPontos = [
              `${x + larguraBarra},${y}`,
              `${x + larguraBarra + profundidade},${y - profundidade}`,
              `${x + larguraBarra + profundidade},${y - profundidade + alturaBarra}`,
              `${x + larguraBarra},${y + alturaBarra}`,
            ].join(" ");

            return (
              <g
                key={ponto.periodo}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{ cursor: "pointer" }}
              >
                {/* área de detecção do hover, cobrindo toda a coluna */}
                <rect x={i * slot} y={0} width={slot} height={BASELINE + ALTURA_EIXO} fill="transparent" />

                {/* sombra projetada no "chão" do gráfico */}
                <ellipse
                  cx={x + larguraBarra / 2 + profundidade / 2}
                  cy={BASELINE + 3}
                  rx={larguraBarra / 2 + profundidade / 2 + 2}
                  ry={4}
                  fill="#000"
                  opacity={0.25}
                  filter="url(#sombraChao3d)"
                />

                <g filter="url(#sombraBarra3d)">
                  {/* face frontal */}
                  <rect x={x} y={y} width={larguraBarra} height={alturaBarra} fill={cor.frente} />
                  {/* face lateral (direita) — mais escura, dá o volume */}
                  <polygon points={ladoPontos} fill={cor.lado} />
                  {/* face superior — mais clara, dá o efeito de "tampa" */}
                  <polygon points={topoPontos} fill={cor.topo} />
                </g>

                <text
                  x={x + larguraBarra / 2 + profundidade / 2}
                  y={y - profundidade - 8}
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight={emHover ? 700 : 600}
                  fill="var(--ink)"
                >
                  {ponto.quantidade}
                </text>

                <text
                  x={x + larguraBarra / 2}
                  y={BASELINE + ALTURA_EIXO - 12}
                  textAnchor="middle"
                  fontSize="12.5"
                  fill="var(--muted)"
                >
                  {formatarRotulo(ponto.periodo, agrupamento)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
