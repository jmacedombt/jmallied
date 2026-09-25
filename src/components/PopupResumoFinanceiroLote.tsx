"use client";

import { PackageCheck, X } from "lucide-react";
import { calcularMetricasPrevisaoResultado, type LinhaPrevisaoResultadoLote } from "@/lib/financeiro";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up de resumo financeiro de um lote (NF Remessa) — aberto ao
// clicar numa linha de Métricas > Orçamentos > Por lote (pedido
// explícito, 25/09/2026). Mesma fonte de dados de Financeiro > Previsão
// de Resultados (ver lib/financeiro.ts) — só considera os aparelhos já
// aprovados pela Allied, sem filtro de período; reprovados contam na
// quantidade, mas com R$ 0 nos valores.
export default function PopupResumoFinanceiroLote({
  nfRemessaAllied,
  dados,
  onFechar,
}: {
  nfRemessaAllied: string;
  dados: LinhaPrevisaoResultadoLote | undefined;
  onFechar: () => void;
}) {
  const m = calcularMetricasPrevisaoResultado(dados ? [dados] : []);

  const linhas = [
    { label: "Quantidade de Orçamentos", valor: String(m.quantidadeAprovados) },
    { label: "Valor de Mão de Obra", valor: formatarReal(m.maoDeObra) },
    { label: "Custo de Peças", valor: formatarReal(m.custoPecas) },
    { label: "Venda de Peças", valor: formatarReal(m.vendaPecas) },
    { label: "Margem de Peças", valor: formatarReal(m.margemPecas) },
    { label: "Margem Total", valor: formatarReal(m.margemTotal), destaque: true },
    { label: "Valor Líquido", valor: formatarReal(m.valorLiquido), destaque: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onFechar}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageCheck size={18} style={{ color: "var(--accent2)" }} />
            Resumo — {nfRemessaAllied}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Considera só os aparelhos já aprovados pela Allied desse lote (direto, via Contra Proposta ou Reorçamento),
          com o valor negociado mais recente de cada um — sem filtro de período.
          {m.quantidadeReprovados > 0 && (
            <>
              {" "}
              <strong style={{ color: "#ef4444" }}>
                {m.quantidadeReprovados} reprovado{m.quantidadeReprovados > 1 ? "s" : ""}
              </strong>{" "}
              nesse lote não entram nos valores.
            </>
          )}
        </p>

        {!dados ? (
          <p
            className="text-sm text-center py-6 rounded-lg"
            style={{ color: "var(--muted)", background: "var(--surface2)" }}
          >
            Nenhum aparelho desse lote já aprovado pela Allied até agora.
          </p>
        ) : (
          <div className="rounded-xl border p-4 space-y-1.5 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            {linhas.map((l) => (
              <div
                key={l.label}
                className={`flex items-center justify-between ${l.destaque ? "pt-1.5 mt-1.5 border-t" : ""}`}
                style={l.destaque ? { borderColor: "var(--line)" } : undefined}
              >
                <span style={{ color: "var(--muted)" }}>{l.label}</span>
                <strong style={{ color: l.destaque ? "var(--accent2)" : "var(--ink)" }}>{l.valor}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end mt-5">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
