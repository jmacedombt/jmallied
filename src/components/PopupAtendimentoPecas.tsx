"use client";

import { useState } from "react";
import { Check, Copy, PackageSearch, X } from "lucide-react";
import { type DetalheValidacaoOrcamento } from "@/lib/orcamentos";

export type AparelhoAtendimentoPecas = {
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

function formatarReal(valor: number | null): string {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up com os dados do atendimento — abre ao clicar numa linha de
// "5 - Ag. Peças" (ver PainelAgPecas.tsx). Mostra as peças e os valores
// já apurados/travados na Validação de Orçamentos (validacao_snapshot,
// congelado no "Confirmar Envio" — o mesmo valor que foi enviado e
// aprovado pela Allied, não recalcula nada aqui). Cada código de peça
// tem um botão "copiar" ao lado pra ajudar a fazer o pedido em outro
// sistema (BID Samsung, por exemplo) sem digitar/errar o Part Number.
export default function PopupAtendimentoPecas({
  aparelho,
  onFechar,
}: {
  aparelho: AparelhoAtendimentoPecas;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  const detalhe = aparelho.validacao_snapshot;
  const pecas = detalhe?.pecas ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Atendimento — {aparelho.trade_allied}
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 text-xs">
          {[
            ["OS Reparadora", aparelho.os_reparadora || "—"],
            ["OS Care Allied", aparelho.os_care_allied || "—"],
            ["Modelo comercial", aparelho.modelo_comercial || "—"],
            ["SKU", aparelho.sku || "—"],
            ["Descrição", aparelho.descricao_completa || "—"],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
              <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted)" }}>
                {rotulo}
              </p>
              <p className="font-medium" style={{ color: "var(--ink)" }} title={valor}>
                {valor}
              </p>
            </div>
          ))}
        </div>

        {!detalhe ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
            Detalhe de peças não disponível pra esse orçamento.
          </p>
        ) : pecas.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
            Esse orçamento não tem nenhuma peça lançada — só mão de obra ({formatarReal(detalhe.maoDeObra)}).
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">Posição</th>
                  <th className="px-3 py-2 font-medium">Part Number</th>
                  <th className="px-3 py-2 font-medium text-right">Custo</th>
                  <th className="px-3 py-2 font-medium text-right">Venda de Peça</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p) => (
                  <tr key={p.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {p.posicao}
                    </td>
                    <td className="px-3 py-2 font-medium" style={{ color: "var(--ink)" }}>
                      <span className="inline-flex items-center gap-1.5">
                        {p.codigo}
                        <button
                          type="button"
                          onClick={() => copiar(p.codigo, p.posicao)}
                          title="Copiar Part Number"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md border transition hover:border-[var(--accent2)]"
                          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                        >
                          {copiado === p.posicao ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarReal(p.custo)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: "var(--ink)" }}>
                      {formatarReal(p.vendaPeca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detalhe && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ["Custo peças", formatarReal(detalhe.custoTotalPecas)],
              ["Imposto", formatarReal(detalhe.impostoTotalPecas)],
              ["Venda peças", formatarReal(detalhe.vendaTotalPecas)],
              ["Mão de obra", formatarReal(detalhe.maoDeObra)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted)" }}>
                  {rotulo}
                </p>
                <p className="font-semibold" style={{ color: "var(--ink)" }}>
                  {valor}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
