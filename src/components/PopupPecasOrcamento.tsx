"use client";

import { useState } from "react";
import { AlertTriangle, PackageSearch, PlusCircle, X } from "lucide-react";
import { type FaixaMarkup, type InfoBidPeca } from "@/lib/bid";
import TooltipCalculoBid from "@/components/TooltipCalculoBid";
import PopupCadastrarPecaBid from "@/components/PopupCadastrarPecaBid";

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

// Pop-up mostrando as 10 posições de peça/valor de um orçamento — abre
// ao clicar na linha da tabela de Ag. Análise. O valor exibido pra cada
// peça vem AO VIVO do BID (busca por Part Number, não o custo gravado no
// próprio orçamento) — quando o BID ainda não tem essa peça cadastrada
// (ou tem, mas sem custo calculado), a linha fica em destaque vermelho
// com um botão pra cadastrar na hora.
export default function PopupPecasOrcamento({
  aparelho,
  precosBid,
  faixas,
  icmsPercentual,
  podeCadastrar,
  onPecaAtualizada,
  onFechar,
}: {
  aparelho: AparelhoComPecas;
  precosBid: Record<string, InfoBidPeca>;
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  podeCadastrar: boolean;
  onPecaAtualizada: (info: InfoBidPeca) => void;
  onFechar: () => void;
}) {
  const [cadastrando, setCadastrando] = useState<{ partNumber: string; prefillModelo: string | null } | null>(null);
  const [tooltip, setTooltip] = useState<{ info: InfoBidPeca; x: number; y: number } | null>(null);

  const linhas = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const peca = aparelho[`peca_${n}` as keyof AparelhoComPecas] as string | null;
    const custoGravado = aparelho[`custo_peca_${n}` as keyof AparelhoComPecas] as number | null;
    const info = peca ? precosBid[peca] : undefined;
    const semValorNoBid = !!peca && (!info || info.custo_peca_allied == null);
    return { n, peca, custoGravado, info, semValorNoBid };
  });

  const algumaPecaPreenchida = linhas.some((l) => l.peca);
  const algumaSemValor = linhas.some((l) => l.semValorNoBid);

  function mostrarTooltip(e: React.MouseEvent, info: InfoBidPeca) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ info, x: Math.max(8, rect.left - 260), y: rect.top });
  }

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

        {algumaSemValor && (
          <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "#ef4444" }}>
            <AlertTriangle size={13} />
            {podeCadastrar
              ? "Peça(s) em vermelho ainda não têm custo no BID — clique em \"Cadastrar\" pra lançar."
              : "Peça(s) em vermelho ainda não têm custo no BID."}
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
              {linhas.map(({ n, peca, custoGravado, info, semValorNoBid }) => (
                <tr
                  key={n}
                  className="border-t"
                  style={{
                    borderColor: semValorNoBid ? "#ef4444" : "var(--line)",
                    background: semValorNoBid ? "rgba(239, 68, 68, 0.08)" : undefined,
                  }}
                >
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {n}
                  </td>
                  <td className="px-3 py-2" style={{ color: peca ? "var(--ink)" : "var(--muted)" }}>
                    {peca || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!peca && <span style={{ color: "var(--muted)" }}>{formatarReal(custoGravado)}</span>}
                    {peca && info && info.custo_peca_allied != null && (
                      <span
                        onMouseEnter={(e) => mostrarTooltip(e, info)}
                        onMouseLeave={() => setTooltip(null)}
                        className="inline-block cursor-help border-b border-dashed"
                        style={{ color: "var(--ink)", borderColor: "var(--muted)" }}
                      >
                        {formatarReal(info.custo_peca_allied)}
                      </span>
                    )}
                    {peca && semValorNoBid && (
                      <button
                        type="button"
                        disabled={!podeCadastrar}
                        onClick={() => setCadastrando({ partNumber: peca, prefillModelo: info?.modelo ?? null })}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.12)" }}
                        title={podeCadastrar ? "Cadastrar valor dessa peça no BID" : "Sem custo no BID"}
                      >
                        <PlusCircle size={12} />
                        {podeCadastrar ? "Cadastrar" : "Sem valor"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-[70] rounded-lg border shadow-2xl p-3"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", left: tooltip.x, top: tooltip.y }}
        >
          <TooltipCalculoBid peca={tooltip.info} faixas={faixas} icmsPercentual={icmsPercentual} />
        </div>
      )}

      {cadastrando && (
        <PopupCadastrarPecaBid
          partNumber={cadastrando.partNumber}
          modeloInicial={cadastrando.prefillModelo}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          onFechar={() => setCadastrando(null)}
          onSalvo={(info) => {
            onPecaAtualizada(info);
            setCadastrando(null);
          }}
        />
      )}
    </div>
  );
}
