"use client";

import { useState } from "react";
import { COR_MAO_DE_OBRA, COR_VENDA_PECAS, type LinhaPrevisaoRecebimento } from "@/lib/metricas";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Versão compacta do valor pro topo de cada barra/hero (ex: "R$ 12,4 mil") —
 * números cheios (com centavos) ficam só no tooltip e na tabela. */
function formatarCompacto(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return formatarReal(valor);
}

/** Quebra o nome da etapa em até 2 linhas pra caber na largura da coluna
 * sem invadir a coluna vizinha — o "sobreposição" que a tela tinha antes
 * era o rótulo de etapas mais longas (ex: "OQC - Controle de Qualidade")
 * estourando em cima do rótulo do card ao lado assim que o número de
 * etapas cresceu de 3 pra 5. */
function quebrarLabel(label: string, maxCaracteres: number): string[] {
  const palavras = label.split(" ");
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (tentativa.length > maxCaracteres && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 2);
}

// viewBox em unidades abstratas — mesmo esquema de GraficoLinhaGradiente.tsx,
// esticado a 100% da largura via preserveAspectRatio="none".
const VIEWBOX_LARGURA = 900;
const PADDING_LADO = 40;
const PADDING_TOPO = 40; // espaço pro total acima da barra mais alta
const ALTURA_EIXO = 42; // espaço pro rótulo da etapa embaixo (até 2 linhas)
const LARGURA_BARRA_MAX = 108;
const GAP_SEGMENTO = 3; // "surface gap" entre Mão de Obra e Peças na mesma barra
const RAIO_TOPO = 5;

/** Caminho de um segmento com o topo arredondado e a base reta — usado
 * só no segmento que está no TOPO da pilha (o "data-end" de verdade);
 * um segmento no meio/base da pilha fica reto dos dois lados (a
 * separação visual vem do "surface gap", nunca de arredondar os dois). */
function caminhoTopoArredondado(x: number, yTopo: number, yBase: number, largura: number, raio: number): string {
  return `M ${x},${yBase} L ${x},${yTopo + raio} Q ${x},${yTopo} ${x + raio},${yTopo} L ${x + largura - raio},${yTopo} Q ${x + largura},${yTopo} ${x + largura},${yTopo + raio} L ${x + largura},${yBase} Z`;
}

/**
 * Barras verticais empilhadas — uma por etapa (5, 6, OQC, 7, Ag.
 * Emissão de NF), cada uma dividida em Mão de Obra (base) + Venda de
 * Peças (topo), com o total da etapa escrito acima. A largura da barra
 * acompanha o espaço disponível por coluna (nunca fixa) — com poucas
 * etapas ela fica no tamanho máximo, com mais etapas ela encolhe pra
 * sempre sobrar respiro entre uma coluna e a próxima, sem sobreposição.
 * Mesma técnica (SVG à mão, sem lib) de GraficoLinhaGradiente/
 * GraficoPecasPorPeriodo, pra manter a mesma cara dos outros gráficos do
 * sistema — com um sombreamento suave nas barras pra dar profundidade.
 * Paleta validada (contraste + CVD) — ver STATUS_PREVISAO_RECEBIMENTO em
 * lib/metricas.ts.
 */
export default function GraficoPrevisaoRecebimento({
  itens,
  altura = 320,
}: {
  itens: (LinhaPrevisaoRecebimento & { label: string })[];
  altura?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const totais = itens.map((i) => i.maoDeObra + i.vendaPecas);
  const maiorTotal = Math.max(1, ...totais);

  const alturaPlot = altura - PADDING_TOPO - ALTURA_EIXO;
  const baseline = PADDING_TOPO + alturaPlot;

  const n = itens.length;
  const largura = VIEWBOX_LARGURA - PADDING_LADO * 2;
  const passo = n > 1 ? largura / n : largura;
  const larguraBarra = Math.min(LARGURA_BARRA_MAX, passo * 0.56);
  const maxCaracteresLabel = Math.max(10, Math.floor(passo / 7));

  const semDados = itens.every((i) => i.maoDeObra === 0 && i.vendaPecas === 0);

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Mão de Obra + Peças por etapa
        </p>
        {/* legenda — sempre presente com 2+ séries (ver skill de dataviz) */}
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COR_MAO_DE_OBRA }} />
            Mão de Obra
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: COR_VENDA_PECAS }} />
            Peças (venda)
          </span>
        </div>
      </div>

      {semDados ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          Nenhum aparelho aprovado nessas etapas no momento.
        </p>
      ) : (
        <svg
          width="100%"
          height={altura}
          viewBox={`0 0 ${VIEWBOX_LARGURA} ${altura}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Mão de Obra e Peças previstas por etapa"
        >
          <defs>
            <filter id="sombraBarraPrevisao" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.28" />
            </filter>
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

          {itens.map((item, i) => {
            const total = item.maoDeObra + item.vendaPecas;
            const centroX = PADDING_LADO + passo * i + passo / 2;
            const x = centroX - larguraBarra / 2;

            const alturaTotal = (total / maiorTotal) * alturaPlot;
            const alturaMaoDeObra = total > 0 ? (item.maoDeObra / total) * alturaTotal : 0;
            const alturaPecas = total > 0 ? (item.vendaPecas / total) * alturaTotal : 0;

            // segmento de Mão de Obra fica na base; Peças em cima, com um
            // "surface gap" de 2-3px separando os dois quando ambos > 0.
            const temGap = alturaMaoDeObra > 0 && alturaPecas > 0;
            const yTopoMaoDeObra = baseline - alturaMaoDeObra;
            const yTopoPecas = yTopoMaoDeObra - (temGap ? GAP_SEGMENTO : 0) - alturaPecas;

            const emHover = hover === i;
            const opacidadeOutros = hover !== null && !emHover ? 0.45 : 1;
            const linhasLabel = quebrarLabel(item.label, maxCaracteresLabel);

            return (
              <g
                key={item.statusOperacional}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((h) => (h === i ? null : h))}
                tabIndex={0}
                style={{ cursor: "pointer", outline: "none" }}
                role="img"
                aria-label={`${item.label}: Mão de Obra ${formatarReal(item.maoDeObra)}, Peças ${formatarReal(item.vendaPecas)}, total ${formatarReal(total)}`}
              >
                {/* área de detecção do hover, cobrindo a coluna inteira (maior que a barra) */}
                <rect x={PADDING_LADO + passo * i} y={0} width={passo} height={altura} fill="transparent" />

                <g opacity={opacidadeOutros} style={{ filter: "url(#sombraBarraPrevisao)" }}>
                  {/* trilho (track) — mostra a escala mesmo pra etapa com 0 */}
                  <rect x={x} y={PADDING_TOPO} width={larguraBarra} height={alturaPlot} rx={RAIO_TOPO} fill="var(--surface2)" />

                  {/* segmento Peças (venda) — sempre o topo da pilha quando presente,
                      então é ele que carrega a ponta arredondada ("data-end"). */}
                  {alturaPecas > 0 && (
                    <path
                      d={caminhoTopoArredondado(x, yTopoPecas, yTopoPecas + alturaPecas, larguraBarra, RAIO_TOPO)}
                      fill={COR_VENDA_PECAS}
                    />
                  )}

                  {/* segmento Mão de Obra — nasce da baseline (base sempre reta). Só
                      ganha o topo arredondado quando é o único segmento (sem Peças
                      em cima); com os dois presentes, o topo fica reto — a separação
                      visual é o "surface gap", nunca dois arredondados encostados. */}
                  {alturaMaoDeObra > 0 &&
                    (temGap ? (
                      <rect x={x} y={yTopoMaoDeObra} width={larguraBarra} height={alturaMaoDeObra} fill={COR_MAO_DE_OBRA} />
                    ) : (
                      <path d={caminhoTopoArredondado(x, yTopoMaoDeObra, baseline, larguraBarra, RAIO_TOPO)} fill={COR_MAO_DE_OBRA} />
                    ))}
                </g>

                {/* total no topo da barra (label seletivo — só o total, não os 2 segmentos) */}
                <text
                  x={centroX}
                  y={Math.max(18, baseline - alturaTotal - 12)}
                  textAnchor="middle"
                  fontSize={emHover ? 15 : 14}
                  fontWeight={700}
                  fill="var(--ink)"
                  opacity={opacidadeOutros}
                >
                  {formatarCompacto(total)}
                </text>

                {/* rótulo da etapa embaixo — quebrado em até 2 linhas pra nunca
                    invadir a coluna vizinha */}
                <text x={centroX} textAnchor="middle" fontSize="12.5" fontWeight={600} fill="var(--muted)" opacity={opacidadeOutros}>
                  {linhasLabel.length === 1 ? (
                    <tspan x={centroX} y={baseline + ALTURA_EIXO - 14}>
                      {linhasLabel[0]}
                    </tspan>
                  ) : (
                    linhasLabel.map((linha, idx) => (
                      <tspan key={linha} x={centroX} y={baseline + ALTURA_EIXO - 26 + idx * 14}>
                        {linha}
                      </tspan>
                    ))
                  )}
                </text>

                {/* tooltip ao hover/foco — os 2 valores + total, texto sempre em tokens de texto */}
                {emHover && (
                  <foreignObject
                    x={Math.min(Math.max(centroX - 100, PADDING_LADO), VIEWBOX_LARGURA - PADDING_LADO - 200)}
                    y={Math.max(0, baseline - alturaTotal - 74)}
                    width={200}
                    height={62}
                  >
                    <div
                      className="rounded-lg border px-3 py-2 text-xs shadow-2xl"
                      style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)", whiteSpace: "nowrap" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COR_MAO_DE_OBRA }} />
                          Mão de Obra
                        </span>
                        <strong>{formatarReal(item.maoDeObra)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-0.5">
                        <span className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COR_VENDA_PECAS }} />
                          Peças
                        </span>
                        <strong>{formatarReal(item.vendaPecas)}</strong>
                      </div>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
