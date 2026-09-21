"use client";

import { useState } from "react";

export type PontoBarra = { rotulo: string; valor: number };

// mesmo sistema de coordenadas (viewBox abstrato, esticado por
// preserveAspectRatio="none") já usado em GraficoLinhaGradiente.tsx —
// aqui adaptado pra barras em vez de linha+área, no layout pedido
// explicitamente (2 gráficos — Notas Emitidas x Valores Recebidos — com
// o valor escrito acima de cada barra, ver financeiro/page.tsx).
const VIEWBOX_LARGURA = 1000;
const PADDING_TOPO = 30;
const PADDING_LADO = 14;
const ALTURA_EIXO = 30;
const LARGURA_BARRA_FRACAO = 0.62; // fração do espaço de cada coluna ocupada pela barra

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Gráfico de barras mensal (pedido explícito, "conforme o print") — um
 * valor por mês, sempre os últimos 12 meses (ver ultimosNMeses em
 * lib/financeiro.ts), com o valor em R$ escrito acima de cada barra.
 * Moeda é sempre formatada aqui dentro (nunca recebida como prop): esse
 * componente é "use client" e as duas telas que o usam hoje
 * (financeiro/page.tsx) são Server Component — passar uma função como
 * prop de Server pra Client Component quebra em produção (mesmo bug já
 * corrigido em GraficoEvolucaoIcms.tsx), então aqui nem existe esse
 * parâmetro: só dado (pontos) cruza essa fronteira.
 */
export default function GraficoBarrasMensal({
  titulo,
  pontos,
  cor = "var(--accent2)",
  altura = 260,
  mensagemVazia = "Nenhum valor nesse período.",
}: {
  titulo?: string;
  pontos: PontoBarra[];
  cor?: string;
  altura?: number;
  mensagemVazia?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const alturaPlot = altura - PADDING_TOPO - ALTURA_EIXO;
  const baseline = PADDING_TOPO + alturaPlot;
  const n = pontos.length;

  const max = Math.max(1, ...pontos.map((p) => p.valor));

  const largura = VIEWBOX_LARGURA - PADDING_LADO * 2;
  const passo = n > 0 ? largura / n : largura;
  const larguraBarra = passo * LARGURA_BARRA_FRACAO;

  const barras = pontos.map((p, i) => {
    const centroX = PADDING_LADO + passo * i + passo / 2;
    const alturaBarra = max > 0 ? (p.valor / max) * alturaPlot : 0;
    return {
      x: centroX - larguraBarra / 2,
      y: baseline - alturaBarra,
      largura: larguraBarra,
      altura: Math.max(alturaBarra, p.valor > 0 ? 2 : 0),
      centroX,
    };
  });

  const totalPeriodo = pontos.reduce((soma, p) => soma + p.valor, 0);

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      {titulo && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {titulo}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Total do período: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{formatarReal(totalPeriodo)}</span>
          </p>
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
          aria-label={titulo ?? "Gráfico de barras mensal"}
        >
          <line
            x1={PADDING_LADO}
            y1={baseline}
            x2={VIEWBOX_LARGURA - PADDING_LADO}
            y2={baseline}
            stroke="var(--line)"
            strokeWidth={1}
          />

          {barras.map((b, i) => {
            const emHover = hover === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{ cursor: "pointer" }}
              >
                <rect x={PADDING_LADO + passo * i} y={0} width={passo} height={altura} fill="transparent" />

                <rect
                  x={b.x}
                  y={b.y}
                  width={b.largura}
                  height={b.altura}
                  rx={4}
                  fill={cor}
                  opacity={emHover ? 1 : 0.85}
                />

                <text
                  x={b.centroX}
                  y={Math.max(14, b.y - 8)}
                  textAnchor="middle"
                  fontSize={emHover ? 12.5 : 11}
                  fontWeight={emHover ? 700 : 600}
                  fill="var(--ink)"
                >
                  {formatarReal(pontos[i].valor)}
                </text>

                <text x={b.centroX} y={baseline + ALTURA_EIXO - 9} textAnchor="middle" fontSize="11" fill="var(--muted)">
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
