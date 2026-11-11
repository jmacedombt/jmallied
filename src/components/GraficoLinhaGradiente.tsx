"use client";

import { useEffect, useId, useRef, useState } from "react";

export type PontoGrafico = { rotulo: string; valor: number };

// largura medida em px reais do container (ResizeObserver) — o viewBox
// acompanha o tamanho de verdade, então texto e linhas saem nítidos, sem
// esticar (antes usava preserveAspectRatio="none" com 1000 unidades fixas,
// o que deformava as letras — pedido de "mais definição", 10/11/2026).
const LARGURA_PADRAO = 1000;
const PADDING_TOPO = 34; // espaço pro valor acima do ponto mais alto
const PADDING_LADO = 44; // px reais — espaço pro valor do 1º e do último ponto
const ALTURA_EIXO = 32; // espaço pro rótulo do período embaixo

/** Catmull-Rom -> Bézier cúbica: curva suave passando por todos os
 * pontos, sem depender de nenhuma biblioteca de gráficos. */
function curvaSuave(pontos: { x: number; y: number }[], yMax?: number): string {
  // yMax = linha de base: limita os pontos de controle pra curva nunca
  // "afundar" abaixo do zero entre dois pontos.
  const lim = (y: number) => (yMax != null ? Math.min(y, yMax) : y);
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
    const c1y = lim(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = lim(p2.y - (p3.y - p1.y) / 6);
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
  eixoNegrito = false,
  animar = false,
  icone,
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
  /** rótulos do eixo horizontal em negrito (Financeiro, 10/11/2026) */
  eixoNegrito?: boolean;
  /** desenha a linha e a área com animação ao carregar/trocar os dados */
  animar?: boolean;
  /** ícone (já animado ou não) antes do título */
  icone?: React.ReactNode;
}) {
  const idGradiente = useId();
  const [hover, setHover] = useState<number | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [VIEWBOX_LARGURA, setLargura] = useState(LARGURA_PADRAO);

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setLargura(w);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const caminhoLinha = curvaSuave(coordenadas, baseline);
  // chave que muda quando os dados mudam → reinicia a animação
  const chaveAnimacao = pontos.map((p) => `${p.rotulo}:${p.valor}`).join("|");
  const caminhoArea =
    coordenadas.length > 0
      ? `${caminhoLinha} L ${coordenadas[coordenadas.length - 1].x},${baseline} L ${coordenadas[0].x},${baseline} Z`
      : "";

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      {(titulo || acoes) && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          {titulo && (
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
              {icone}
              {titulo}
            </p>
          )}
          {acoes}
        </div>
      )}

      <div ref={caixaRef} className="w-full">
      {pontos.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          {mensagemVazia}
        </p>
      ) : (
        <svg
          key={animar ? chaveAnimacao : undefined}
          width="100%"
          height={altura}
          viewBox={`0 0 ${VIEWBOX_LARGURA} ${altura}`}
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

          {caminhoArea && (
            <path d={caminhoArea} fill={`url(#${idGradiente})`} className={animar ? "grafico-area-surgir" : undefined} />
          )}
          {caminhoLinha && (
            <path
              d={caminhoLinha}
              fill="none"
              stroke={corLinha}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={animar ? 1 : undefined}
              className={animar ? "grafico-linha-desenhar" : undefined}
            />
          )}

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

                <text
                  x={c.x}
                  y={baseline + ALTURA_EIXO - 10}
                  textAnchor="middle"
                  fontSize={eixoNegrito ? 12.5 : 12}
                  fontWeight={eixoNegrito ? 700 : 400}
                  fill={eixoNegrito ? "var(--ink)" : "var(--muted)"}
                >
                  {pontos[i].rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      </div>
    </div>
  );
}
