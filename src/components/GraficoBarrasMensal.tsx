"use client";

import { useId, useState } from "react";

export type PontoBarra = { rotulo: string; valor: number };

/** Clareia uma cor "#rrggbb" por um fator 0..1 (0 = cor original, 1 =
 * branco) — usado só pro stop de cima do degradê (ver estiloBarra
 * "degrade" abaixo). Devolve null pra qualquer cor que não seja um hex
 * de 6 dígitos (ex: uma var(--...) — aí a barra cai pro preenchimento
 * sólido normal, nunca quebra por tentar interpretar a cor). */
function clarearHex(hex: string, fator: number): string | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const misturar = (c: number) => Math.round(c + (255 - c) * fator);
  return `rgb(${misturar(r)}, ${misturar(g)}, ${misturar(b)})`;
}

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
 * valor por mês, com o valor em R$ escrito acima de cada barra. A
 * quantidade de meses é decidida por quem chama (ver ultimosNMeses em
 * lib/financeiro.ts e os dois usos em financeiro/page.tsx: 6 meses pra
 * Notas Emitidas, 12 pra Valores Recebidos — pedido explícito, 02/10/2026).
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
  estiloBarra = "solido",
}: {
  titulo?: string;
  pontos: PontoBarra[];
  cor?: string;
  altura?: number;
  mensagemVazia?: string;
  /** "degrade" (pedido explícito, 02/10/2026 — gráfico de Notas
   * Emitidas em financeiro/page.tsx) pinta a barra com um degradê
   * (mais clara no topo, a cor cheia na base) e aplica uma sombra
   * suave projetada na cor da barra. "solido" (padrão) mantém o
   * visual original — cor chapada, sem sombra —, usado em todo o
   * resto que já usa esse componente. Cai pro sólido sozinho se `cor`
   * não for um hex de 6 dígitos (ver clarearHex). */
  estiloBarra?: "solido" | "degrade";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const idUnico = useId().replace(/[^a-zA-Z0-9]/g, "");
  const corClara = estiloBarra === "degrade" ? clarearHex(cor, 0.45) : null;
  const usaDegrade = corClara !== null;
  const idGradiente = `grad-barra-${idUnico}`;
  const idSombra = `sombra-barra-${idUnico}`;

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
          {usaDegrade && (
            <defs>
              <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={corClara!} />
                <stop offset="100%" stopColor={cor} />
              </linearGradient>
              <filter id={idSombra} x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={cor} floodOpacity="0.45" />
              </filter>
            </defs>
          )}

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
                  fill={usaDegrade ? `url(#${idGradiente})` : cor}
                  filter={usaDegrade ? `url(#${idSombra})` : undefined}
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
