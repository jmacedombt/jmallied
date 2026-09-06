"use client";

import { useId, useState } from "react";

export type PontoGrafico = { rotulo: string; valor: number };

// sistema de coordenadas do viewBox (unidades abstratas, não pixels) —
// a largura é esticada por preserveAspectRatio="none" pra sempre ocupar
// 100% do espaço disponível, só a altura fica fixa (em px reais). Mesmo
// esquema de GraficoPecasPorPeriodo.tsx, adaptado pra linha + área.
const VIEWBOX_LARGURA = 1000;
const PADDING_TOPO = 34; // espaço pro valor acima do ponto mais alto
const PADDING_LADO = 22;
const ALTURA_EIXO = 32; // espaço pro rótulo do período embaixo

/** Catmull-Rom -> Bézier cúbica: curva suave passando por todos os
 * pontos, sem depender de nenhuma biblioteca de gráficos. */
function curvaSuave(pontos: { x: number; y: number }[]): string {
  if (pontos.length === 0) return "";
  if (pontos.length === 1) return `M ${pontos[0].x},${pontos[0].y}`;
  if (pontos.length === 2) return `M ${pontos[0].x},${pontos[0].y} L ${pontos[1].x},${pontos[1].y}`;

  let d = `M ${pontos[0].x},${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Gráfico de linha com área sombreada em degradê e o valor de cada ponto
// escrito acima dele — estilo pedido explicitamente pelo Rafael (com
// referências visuais próprias), por isso foge da recomendação padrão de
// "rotular só o essencial": aqui o valor em cada ponto É o pedido.
export default function GraficoLinhaGradiente({
  titulo,
  acoes,
  pontos,
  formatarValor = (v) => String(Math.round(v)),
  corLinha = "var(--accent2)",
  altura = 260,
  mensagemVazia = "Nenhum dado nesse período.",
}: {
  titulo?: React.ReactNode;
  /** conteúdo extra no canto direito do cabeçalho, ao lado do título —
   * ex: os botões de alternar Mês/Semana/Ano (ver GraficoPecasPorPeriodo.tsx). */
  acoes?: React.ReactNode;
  pontos: PontoGrafico[];
  formatarValor?: (valor: number) => string;
  corLinha?: string;
  altura?: number;
  mensagemVazia?: string;
}) {
  const idGradiente = useId();
  const [hover, setHover] = useState<number | null>(null);

  const alturaPlot = altura - PADDING_TOPO - ALTURA_EIXO;
  const baseline = PADDING_TOPO + alturaPlot;
  const n = pontos.length;

  const max = Math.max(1, ...pontos.map((p) => p.valor));
  const min = Math.min(0, ...pontos.map((p) => p.valor));
  const amplitude = max - min || 1;

  const largura = VIEWBOX_LARGURA - PADDING_LADO * 2;
  const passo = n > 1 ? largura / (n - 1) : 0;

  const coordenadas = pontos.map((p, i) => ({
    x: n > 1 ? PADDING_LADO + i * passo : PADDING_LADO + largura / 2,
    y: baseline - ((p.valor - min) / amplitude) * alturaPlot,
  }));

  const caminhoLinha = curvaSuave(coordenadas);
  const caminhoArea =
    coordenadas.length > 0
      ? `${caminhoLinha} L ${coordenadas[coordenadas.length - 1].x},${baseline} L ${coordenadas[0].x},${baseline} Z`
      : "";

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      {(titulo || acoes) && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          {titulo && (
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {titulo}
            </p>
          )}
          {acoes}
        </div>
      )}

      {pontos.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          {mensagemVazia}
        </p>
      ) : (
        <svg
          width="100%"
          height={altura}
          viewBox={`0 0 ${VIEWBOX_LARGURA} ${altura}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={typeof titulo === "string" ? titulo : "Gráfico de linha"}
        >
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corLinha} stopOpacity={0.32} />
              <stop offset="100%" stopColor={corLinha} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* linha de base (eixo) — hairline recessivo */}
          <line
            x1={PADDING_LADO}
            y1={baseline}
            x2={VIEWBOX_LARGURA - PADDING_LADO}
            y2={baseline}
            stroke="var(--line)"
            strokeWidth={1}
          />

          {caminhoArea && <path d={caminhoArea} fill={`url(#${idGradiente})`} />}
          {caminhoLinha && <path d={caminhoLinha} fill="none" stroke={corLinha} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

          {coordenadas.map((c, i) => {
            const emHover = hover === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{ cursor: "pointer" }}
              >
                {/* área de detecção do hover, cobrindo a coluna inteira do ponto */}
                <rect
                  x={n > 1 ? c.x - passo / 2 : 0}
                  y={0}
                  width={n > 1 ? passo : VIEWBOX_LARGURA}
                  height={altura}
                  fill="transparent"
                />

                {emHover && (
                  <line x1={c.x} y1={PADDING_TOPO - 10} x2={c.x} y2={baseline} stroke="var(--line)" strokeWidth={1} strokeDasharray="3,3" />
                )}

                <circle cx={c.x} cy={c.y} r={emHover ? 6 : 4} fill={corLinha} stroke="var(--surface)" strokeWidth={2} />

                <text
                  x={c.x}
                  y={Math.max(14, c.y - 14)}
                  textAnchor="middle"
                  fontSize={emHover ? 13 : 12}
                  fontWeight={emHover ? 700 : 600}
                  fill="var(--ink)"
                >
                  {formatarValor(pontos[i].valor)}
                </text>

                <text x={c.x} y={baseline + ALTURA_EIXO - 10} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  {pontos[i].rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
