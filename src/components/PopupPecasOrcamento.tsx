"use client";

import { PackageSearch, X } from "lucide-react";

export type AparelhoComPecas = {
  os_reparadora: string | null;
  trade_allied: string;
  peca_1: string | null;
  peca_2: string | null;
  peca_3: string | null;
  peca_4: string | null;
  peca_5: string | null;
  peca_6: string | null;
  peca_7: string | null;
  peca_8: string | null;
  peca_9: string | null;
  peca_10: string | null;
  custo_peca_1: number | null;
  custo_peca_2: number | null;
  custo_peca_3: number | null;
  custo_peca_4: number | null;
  custo_peca_5: number | null;
  custo_peca_6: number | null;
  custo_peca_7: number | null;
  custo_peca_8: number | null;
  custo_peca_9: number | null;
  custo_peca_10: number | null;
};

function formatarReal(valor: number | null): string {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up de consulta (só leitura) mostrando as 10 posições de peça/valor
// de um orçamento — abre ao clicar na linha da tabela de Ag. Análise. Se
// não tiver peça lançada em alguma posição, mostra "—" / R$ 0,00 em vez
// de esconder a linha, pra ficar claro que ainda não tem essa peça.
export default function PopupPecasOrcamento({
  aparelho,
  onFechar,
}: {
  aparelho: AparelhoComPecas;
  onFechar: () => void;
}) {
  const linhas = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const peca = aparelho[`peca_${n}` as keyof AparelhoComPecas] as string | null;
    const custo = aparelho[`custo_peca_${n}` as keyof AparelhoComPecas] as number | null;
    return { n, peca, custo };
  });

  const algumaPecaPreenchida = linhas.some((l) => l.peca);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Peças do orçamento
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
          {aparelho.trade_allied} · OS Reparadora {aparelho.os_reparadora || "—"}
        </p>

        {!algumaPecaPreenchida && (
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Nenhuma peça lançada pra esse orçamento ainda.
          </p>
        )}

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Peça</th>
                <th className="px-3 py-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ n, peca, custo }) => (
                <tr key={n} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {n}
                  </td>
                  <td className="px-3 py-2" style={{ color: peca ? "var(--ink)" : "var(--muted)" }}>
                    {peca || "—"}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: peca ? "var(--ink)" : "var(--muted)" }}>
                    {formatarReal(custo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
