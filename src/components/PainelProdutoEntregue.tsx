"use client";

import { useState } from "react";
import { PackageCheck, X } from "lucide-react";
import PainelEtapaSimples, { type AparelhoEtapaSimples } from "@/components/PainelEtapaSimples";

type Perfil = { cargo: string; is_master: boolean } | null;

export type LinhaProdutoEntregueLote = {
  nfRemessa: string;
  totalLote: number;
  quantidadeEntregue: number;
};

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/**
 * Tela "Produto Entregue" (pedido explícito) — em vez de listar cada
 * aparelho solto, agrupa por NF Remessa: número da NF, quantidade TOTAL
 * de orçamentos já importados com essa NF (qualquer status, desde
 * sempre — ver migration 0052) e quantos desses já foram dados como
 * Produto Entregue, com o percentual concluído daquele lote.
 *
 * Clicar numa linha abre um pop-up com os aparelhos ENTREGUES daquele
 * lote, individualmente — reaproveita o mesmo PainelEtapaSimples já
 * usado antes aqui (clique no aparelho pra ver peças/NF, sem opção de
 * reprovar, já que Produto Entregue é etapa final).
 */
export default function PainelProdutoEntregue({
  lotes,
  aparelhosPorLote,
  perfil,
  solucoesPorPartNumber = {},
  mensagemVazia = "Nenhum lote com aparelho entregue ainda.",
}: {
  lotes: LinhaProdutoEntregueLote[];
  aparelhosPorLote: Record<string, AparelhoEtapaSimples[]>;
  perfil: Perfil;
  /** "Peça Solução" (BID) de cada código — pedido explícito, mostrada em
   * toda tela que lista as peças de um atendimento (ver
   * buscarSolucoesPorPartNumber em lib/bid.ts). */
  solucoesPorPartNumber?: Record<string, string>;
  mensagemVazia?: string;
}) {
  const [loteAberto, setLoteAberto] = useState<string | null>(null);

  const itensDoLoteAberto = loteAberto ? (aparelhosPorLote[loteAberto] ?? []) : [];

  return (
    <>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium text-right">Total importado</th>
              <th className="px-4 py-2.5 font-medium text-right">Entregues</th>
              <th className="px-4 py-2.5 font-medium text-right">% concluído do lote</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => {
              const percentual = l.totalLote > 0 ? (l.quantidadeEntregue / l.totalLote) * 100 : 0;
              return (
                <tr
                  key={l.nfRemessa}
                  onClick={() => setLoteAberto(l.nfRemessa)}
                  className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  title="Clique pra ver os aparelhos entregues dessa NF Remessa"
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {l.nfRemessa}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {l.totalLote}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {l.quantidadeEntregue}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold"
                      style={{ color: "#0d9488", background: "rgba(13, 148, 136, 0.12)", border: "1px solid rgba(13, 148, 136, 0.35)" }}
                    >
                      <PackageCheck size={11} />
                      {formatarPercentual(percentual)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {lotes.length === 0 && (
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
            className="w-full max-w-5xl max-h-[92vh] rounded-2xl border shadow-2xl p-5 overflow-y-auto"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                NF Remessa <span style={{ color: "var(--accent2)" }}>{loteAberto}</span> — {itensDoLoteAberto.length}{" "}
                entregue(s)
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

            <PainelEtapaSimples
              aparelhos={itensDoLoteAberto}
              permiteReprovar={false}
              perfil={perfil}
              mostrarNotasFiscais
              solucoesPorPartNumber={solucoesPorPartNumber}
              mensagemVazia="Nenhum aparelho entregue nesse lote."
            />
          </div>
        </div>
      )}
    </>
  );
}
