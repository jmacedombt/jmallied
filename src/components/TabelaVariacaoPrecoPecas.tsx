import { formatarDataBr } from "@/lib/pecas";

export type VariacaoPreco = {
  codigo: string;
  descricao: string | null;
  data_anterior: string | null;
  valor_unitario_anterior: number | null;
  data_atual: string | null;
  valor_unitario_atual: number | null;
  variacao_percentual: number | null;
};

function formatarMoeda(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CABECALHOS = [
  "Part Number",
  "Data anterior",
  "Valor Unit. anterior",
  "Data da atualização",
  "Valor Unit. novo",
  "Variação",
];

// Relação de peças cuja compra mais recente já veio com um valor unitário
// diferente da compra anterior (janela padrão de 60 dias) — vem da RPC
// pecas_variacao_preco_recente (migration 0023). Peças sem mudança de
// valor não aparecem nessa lista (já filtradas no banco).
export default function TabelaVariacaoPrecoPecas({ linhas }: { linhas: VariacaoPreco[] }) {
  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Variação de preço nos últimos 60 dias
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          Nenhuma peça teve o valor unitário alterado nos últimos 60 dias.
        </p>
      ) : (
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-left">
                {CABECALHOS.map((titulo) => (
                  <th
                    key={titulo}
                    className="sticky top-0 z-10 px-4 py-2.5 font-medium whitespace-nowrap"
                    style={{ background: "var(--surface2)", color: "var(--muted)" }}
                  >
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const percentual = l.variacao_percentual ?? 0;
                const aumentou = percentual > 0;
                const cor = aumentou ? "#ef4444" : "#22c55e";
                return (
                  <tr key={l.codigo} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td
                      className="px-4 py-2.5 font-mono whitespace-nowrap"
                      style={{ color: "var(--ink)" }}
                      title={l.descricao ?? undefined}
                    >
                      {l.codigo}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {formatarDataBr(l.data_anterior)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {formatarMoeda(l.valor_unitario_anterior)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {formatarDataBr(l.data_atual)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ color: "var(--ink)" }}>
                      {formatarMoeda(l.valor_unitario_atual)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold" style={{ color: cor }}>
                      {aumentou ? "▲" : "▼"} {Math.abs(percentual).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
