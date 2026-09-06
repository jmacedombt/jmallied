"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
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

/** Data/hora "agora" no fuso de Brasília, pro nome do arquivo exportado —
 * mesma lógica usada no Relatório BID (api/bases/bid/relatorio/route.ts),
 * só que rodando no navegador (aqui não tem servidor no meio). */
function agoraBrasiliaArquivo(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("day")}${valor("month")}${valor("year")}_${valor("hour")}${valor("minute")}`;
}

const CABECALHOS: { chave: string; label: string }[] = [
  { chave: "codigo", label: "Part Number" },
  { chave: "data_anterior", label: "Data anterior" },
  { chave: "valor_unitario_anterior", label: "Valor Unit. anterior" },
  { chave: "data_atual", label: "Data da atualização" },
  { chave: "valor_unitario_atual", label: "Valor Unit. novo" },
  { chave: "variacao_percentual", label: "Variação" },
];

// Relação de peças cuja compra mais recente já veio com um valor unitário
// diferente da compra anterior (janela padrão de 60 dias) — vem da RPC
// pecas_variacao_preco_recente (migration 0023). Peças sem mudança de
// valor não aparecem nessa lista (já filtradas no banco).
export default function TabelaVariacaoPrecoPecas({ linhas }: { linhas: VariacaoPreco[] }) {
  // ordenação só pela coluna Variação, por enquanto — é a que o Rafael
  // pediu explicitamente pra poder ordenar (menor -> maior num clique,
  // maior -> menor no clique seguinte).
  const [ordem, setOrdem] = useState<"asc" | "desc" | null>(null);

  const linhasOrdenadas = useMemo(() => {
    if (!ordem) return linhas;
    const copia = [...linhas];
    copia.sort((a, b) => {
      const va = a.variacao_percentual ?? 0;
      const vb = b.variacao_percentual ?? 0;
      return ordem === "asc" ? va - vb : vb - va;
    });
    return copia;
  }, [linhas, ordem]);

  function alternarOrdem() {
    setOrdem((atual) => (atual === "asc" ? "desc" : "asc"));
  }

  function exportarExcel() {
    // import dinâmico: a lib "xlsx" só precisa existir no navegador na
    // hora do clique, não no bundle inicial da página.
    import("xlsx").then((XLSX) => {
      const cabecalho = [
        "Part Number",
        "Descrição",
        "Data anterior",
        "Valor Unit. anterior (R$)",
        "Data da atualização",
        "Valor Unit. novo (R$)",
        "Variação (%)",
      ];
      const corpo = linhasOrdenadas.map((l) => [
        l.codigo,
        l.descricao ?? "",
        formatarDataBr(l.data_anterior),
        l.valor_unitario_anterior ?? "",
        formatarDataBr(l.data_atual),
        l.valor_unitario_atual ?? "",
        l.variacao_percentual ?? "",
      ]);

      const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);
      planilha["!cols"] = [
        { wch: 18 },
        { wch: 34 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, planilha, "Variação de Preço");
      XLSX.writeFile(workbook, `Variacao_Preco_Pecas_${agoraBrasiliaArquivo()}.xlsx`);
    });
  }

  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <div
        className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b"
        style={{ borderColor: "var(--line)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Variação de preço nos últimos 60 dias
        </p>
        {linhas.length > 0 && (
          <button
            type="button"
            onClick={exportarExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)]"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Download size={13} />
            Exportar Excel
          </button>
        )}
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
                {CABECALHOS.map((c) => {
                  const ehVariacao = c.chave === "variacao_percentual";
                  return (
                    <th
                      key={c.chave}
                      className="sticky top-0 z-10 px-4 py-2.5 font-medium whitespace-nowrap"
                      style={{ background: "var(--surface2)", color: "var(--muted)" }}
                    >
                      {ehVariacao ? (
                        <button
                          type="button"
                          onClick={alternarOrdem}
                          className="inline-flex items-center gap-1 hover:text-[var(--ink)] transition"
                          title="Ordenar por variação"
                        >
                          {c.label}
                          {ordem === "asc" && <ArrowUp size={12} />}
                          {ordem === "desc" && <ArrowDown size={12} />}
                          {!ordem && <ArrowUpDown size={12} />}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {linhasOrdenadas.map((l) => {
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
                      {aumentou ? "▲" : "▼"}{" "}
                      {Math.abs(percentual).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      %
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
