/** Célula da matriz de Backlog por lote (Operacional > Backlog) — uma
 * combinação lote x etapa numerada: quantidade, percentual (sobre o
 * total do lote naquela linha) e uma barrinha colorida (cor fixa por
 * coluna/etapa, ver CORES_ETAPAS_BACKLOG em backlog/page.tsx) — pedido
 * explícito ("percentual com uma barra gráfica cada um com uma cor pra
 * diferenciar"). Célula em branco (traço) quando o lote não tem nenhum
 * aparelho parado naquela etapa. */
export default function CelulaBacklogEtapa({
  quantidade,
  percentual,
  cor,
}: {
  quantidade: number;
  percentual: number;
  cor: string;
}) {
  if (quantidade === 0) {
    return <span style={{ color: "var(--muted)" }}>—</span>;
  }
  return (
    <div className="min-w-[90px]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {quantidade}
        </span>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {percentual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(100, percentual)}%`, background: cor }}
        />
      </div>
    </div>
  );
}
