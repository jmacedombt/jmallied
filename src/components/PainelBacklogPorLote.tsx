"use client";

import { useState } from "react";
import { Gauge, X } from "lucide-react";
import { STATUS_OPERACIONAL, GRUPO_STATUS_AG_EMISSAO_NF } from "@/lib/orcamentos";
import { formatarDias } from "@/lib/metricas";

export type LinhaBacklogResumo = {
  nfRemessa: string;
  totalLote: number;
  quantidadePendente: number;
  quantidadeEntregue: number;
  quantidadeReprovada: number;
  mediaRtatPendenteDias: number | null;
};

// mesma identidade de cor de cada etapa usada no Painel Operacional (ver
// CORES em operacional/page.tsx) — só pra diferenciar visualmente as
// linhas do pop-up de detalhe, sem outro significado.
const CORES_STATUS: Record<string, string> = {
  "ag-abertura": "#64748b",
  "1-ag-triagem": "#2563eb",
  "2-ag-analise": "#7c3aed",
  "validacao-orcamentos": "#14b8a6",
  "3-ag-resposta-orcamento": "#d97706",
  "ag-contra-proposta": "#ca8a04",
  "4-ag-resposta-reorcamento": "#ea580c",
  "5-ag-pecas": "#0891b2",
  "6-ag-reparo": "#9333ea",
  "oqc-controle-qualidade": "#4f46e5",
  "7-reparo-finalizado": "#059669",
  "8-orcamento-reprovado": "#dc2626",
  "ag-emissao-nf": "#0ea5e9",
  "produto-entregue": "#0d9488",
};

function quantidadeDoStatusNoLote(porStatus: Record<string, number>, status: (typeof STATUS_OPERACIONAL)[number]): number {
  if (status.slug === "ag-emissao-nf") {
    return GRUPO_STATUS_AG_EMISSAO_NF.reduce((soma, v) => soma + (porStatus[v] ?? 0), 0);
  }
  return porStatus[status.valor] ?? 0;
}

/**
 * Tabela principal do Backlog (pedido explícito, substitui a matriz de
 * colunas numeradas da versão anterior): uma linha por lote (NF Remessa)
 * ainda com algo pendente — total do lote (todos os orçamentos já
 * importados com essa NF, qualquer status), quantidade pendente (antes
 * de virar Produto Entregue) e o R-TAT médio de quem está pendente.
 *
 * Clicar numa linha abre um pop-up com a quantidade em CADA status/card
 * (todos, não só os numerados) daquele lote — a visualização mostra
 * tudo; só a exportação em Excel (botão "Exportar backlog", inalterado)
 * continua seguindo a regra vigente de só considerar os status com
 * numeração.
 */
export default function PainelBacklogPorLote({
  linhas,
  detalhePorLote,
  mensagemVazia = "Nenhum lote com pendência no momento.",
}: {
  linhas: LinhaBacklogResumo[];
  /** nf_remessa_allied -> { status_operacional: quantidade } — TODOS os
   * status, usado só pelo pop-up de detalhe (ver migration 0053). */
  detalhePorLote: Record<string, Record<string, number>>;
  mensagemVazia?: string;
}) {
  const [loteAberto, setLoteAberto] = useState<string | null>(null);

  const porStatusDoLoteAberto = loteAberto ? (detalhePorLote[loteAberto] ?? {}) : {};
  const totalDoLoteAberto = linhas.find((l) => l.nfRemessa === loteAberto)?.totalLote ?? 0;

  return (
    <>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Lote (NF Remessa)</th>
              <th className="px-4 py-2.5 font-medium text-right">Total do lote</th>
              <th className="px-4 py-2.5 font-medium text-right">Pendente (antes do Produto Entregue)</th>
              <th className="px-4 py-2.5 font-medium text-right">R-TAT médio</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.nfRemessa}
                onClick={() => setLoteAberto(l.nfRemessa)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver a quantidade em cada status desse lote"
              >
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {l.nfRemessa}
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {l.totalLote}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                  {l.quantidadePendente}
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {l.mediaRtatPendenteDias != null ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Gauge size={12} style={{ color: "var(--accent2)" }} />
                      {formatarDias(l.mediaRtatPendenteDias)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {mensagemVazia}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div
            className="w-full max-w-lg max-h-[92vh] rounded-2xl border shadow-2xl p-5 overflow-y-auto"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                Lote <span style={{ color: "var(--accent2)" }}>{loteAberto}</span>
              </h2>
              <button
                type="button"
                onClick={() => setLoteAberto(null)}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Quantidade em cada status/card desse lote, de {totalDoLoteAberto} orçamento(s) importado(s) no total.
            </p>

            <div className="space-y-3">
              {STATUS_OPERACIONAL.map((status) => {
                const quantidade = quantidadeDoStatusNoLote(porStatusDoLoteAberto, status);
                const percentual = totalDoLoteAberto > 0 ? (quantidade / totalDoLoteAberto) * 100 : 0;
                const cor = CORES_STATUS[status.slug];
                return (
                  <div key={status.slug}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                        {status.label}
                      </span>
                      <span className="text-xs font-medium shrink-0" style={{ color: "var(--muted)" }}>
                        {quantidade} · {percentual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
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
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
