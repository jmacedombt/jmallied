"use client";

import { useState } from "react";
import { PackageCheck, X } from "lucide-react";
import { calcularMetricasPrevisaoResultado, type LinhaPrevisaoResultadoLote, type MetricasPrevisaoResultado } from "@/lib/financeiro";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mesmas explicações usadas em Financeiro > Previsão de Resultados
// (PainelPrevisaoResultados.tsx, pedido explícito, 29/09/2026) — cada
// linha mostra, ao passar o mouse, como aquele valor foi calculado.
function explicacao(m: MetricasPrevisaoResultado, label: string): string[] {
  switch (label) {
    case "Valor de Mão de Obra":
      return [`Soma da mão de obra de ${m.quantidadeAprovados} orçamento(s) aprovado(s) nesse lote.`];
    case "Custo de Peças":
      return ["Soma do custo (Base Peças) das peças de todos os orçamentos aprovados desse lote — sem markup nem ICMS."];
    case "Imposto (ICMS)":
      return ["Soma do ICMS aplicado sobre o custo das peças de todos os orçamentos aprovados desse lote."];
    case "Venda de Peças":
      return ["Soma do valor de venda das peças (custo com markup do BID, já com ICMS) de todos os orçamentos aprovados desse lote."];
    case "Margem de Peças":
      return [
        `Venda de Peças ${formatarReal(m.vendaPecas)} − Custo de Peças ${formatarReal(m.custoPecas)} − Imposto (ICMS) ${formatarReal(
          m.impostoPecas
        )} = ${formatarReal(m.margemPecas)}`,
      ];
    case "Margem Total":
      return [`Margem de Peças ${formatarReal(m.margemPecas)} + Mão de Obra ${formatarReal(m.maoDeObra)} = ${formatarReal(m.margemTotal)}`];
    case "Valor Líquido":
      return [
        `Venda de Peças ${formatarReal(m.vendaPecas)} + Mão de Obra ${formatarReal(m.maoDeObra)} = ${formatarReal(m.valorLiquido)} — o total cobrado da Allied, sem descontar custo/imposto.`,
      ];
    default:
      return [];
  }
}

// Pop-up de resumo financeiro de um lote (NF Remessa) — aberto ao
// clicar numa linha de Métricas > Orçamentos > Por lote (pedido
// explícito, 25/09/2026). Mesma fonte de dados de Financeiro > Previsão
// de Resultados (ver lib/financeiro.ts) — só considera os aparelhos já
// aprovados pela Allied, sem filtro de período; reprovados contam na
// quantidade, mas com R$ 0 nos valores. Linha Imposto (ICMS) + tooltip
// com o cálculo detalhado ao passar o mouse (pedido explícito,
// 29/09/2026 — mesma melhoria de Previsão de Resultados).
export default function PopupResumoFinanceiroLote({
  nfRemessaAllied,
  dados,
  onFechar,
}: {
  nfRemessaAllied: string;
  dados: LinhaPrevisaoResultadoLote | undefined;
  onFechar: () => void;
}) {
  const [dica, setDica] = useState<{ label: string; linhas: string[]; x: number; y: number } | null>(null);

  const m = calcularMetricasPrevisaoResultado(dados ? [dados] : []);

  const linhas = [
    { label: "Quantidade de Orçamentos", valor: String(m.quantidadeAprovados) },
    { label: "Valor de Mão de Obra", valor: formatarReal(m.maoDeObra) },
    { label: "Custo de Peças", valor: formatarReal(m.custoPecas) },
    { label: "Imposto (ICMS)", valor: formatarReal(m.impostoPecas) },
    { label: "Venda de Peças", valor: formatarReal(m.vendaPecas) },
    { label: "Margem de Peças", valor: formatarReal(m.margemPecas) },
    { label: "Margem Total", valor: formatarReal(m.margemTotal), destaque: true },
    { label: "Valor Líquido", valor: formatarReal(m.valorLiquido), destaque: true },
  ];

  function mostrarDica(e: React.MouseEvent, label: string) {
    const linhasExplicacao = explicacao(m, label);
    if (linhasExplicacao.length === 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(Math.max(rect.left, 8), window.innerWidth - 320);
    setDica({ label, linhas: linhasExplicacao, x, y: rect.bottom + 8 });
  }
  function ocultarDica() {
    setDica(null);
  }

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
            {linhas.map((l) => {
              const temDica = explicacao(m, l.label).length > 0;
              return (
                <div
                  key={l.label}
                  className={`flex items-center justify-between ${l.destaque ? "pt-1.5 mt-1.5 border-t" : ""} ${temDica ? "cursor-help" : ""}`}
                  style={l.destaque ? { borderColor: "var(--line)" } : undefined}
                  onMouseEnter={temDica ? (e) => mostrarDica(e, l.label) : undefined}
                  onMouseLeave={temDica ? ocultarDica : undefined}
                >
                  <span style={{ color: "var(--muted)" }}>{l.label}</span>
                  <strong style={{ color: l.destaque ? "var(--accent2)" : "var(--ink)" }}>{l.valor}</strong>
                </div>
              );
            })}
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

      {dica && (
        <div
          className="fixed z-50 rounded-lg border px-3 py-2 text-xs shadow-2xl"
          style={{ left: dica.x, top: dica.y, maxWidth: 300, background: "var(--surface)", borderColor: "var(--accent2)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>
            {dica.label}
          </p>
          {dica.linhas.map((linha, i) => (
            <p key={i} style={{ color: "var(--muted)" }}>
              {linha}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
