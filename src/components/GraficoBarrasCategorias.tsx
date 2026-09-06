"use client";

export type ItemBarraCategoria = { rotulo: string; valor: number };

// Barras horizontais tipo "medidor" (trilho + preenchimento), pra
// comparar uma métrica entre categorias com rótulo longo (ex: os 11
// status do Operacional) — mais legível que barras verticais quando o
// texto da categoria não cabe embaixo de uma coluna estreita.
export default function GraficoBarrasCategorias({
  titulo,
  itens,
  formatarValor = (v) => String(v),
  cor = "var(--accent2)",
  mensagemVazia = "Nenhum dado no momento.",
}: {
  titulo?: React.ReactNode;
  itens: ItemBarraCategoria[];
  formatarValor?: (valor: number) => string;
  cor?: string;
  mensagemVazia?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      {titulo && (
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>
          {titulo}
        </p>
      )}

      {itens.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          {mensagemVazia}
        </p>
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <div key={item.rotulo} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-xs text-right" style={{ color: "var(--muted)" }}>
                {item.rotulo}
              </span>
              <div className="flex-1 rounded-full h-3" style={{ background: "var(--surface2)" }}>
                <div
                  className="h-3 rounded-full transition-all"
                  style={{ width: `${Math.max(2, (item.valor / max) * 100)}%`, background: cor }}
                />
              </div>
              <span className="w-10 shrink-0 text-xs font-semibold" style={{ color: "var(--ink)" }}>
                {formatarValor(item.valor)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
