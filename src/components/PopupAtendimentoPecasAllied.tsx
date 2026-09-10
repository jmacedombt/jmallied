"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { type AparelhoOperacionalAllied } from "@/lib/allied";

function formatarReal(valor: number | null | undefined) {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Mesmo pop-up de atendimento/peças de PopupAtendimentoPecas.tsx, só que
 * pro cargo ALLIED: os dados vêm da RPC orcamentos_allied_listar (ver
 * lib/allied.ts), que nunca traz nenhuma coluna de custo/BID — então
 * esse componente nem tem como mostrar custo por engano, porque o dado
 * simplesmente não existe no objeto que ele recebe. Só o valor de venda
 * (o que cobramos) e a mão de obra cobrada.
 */
export default function PopupAtendimentoPecasAllied({
  aparelho,
  onFechar,
}: {
  aparelho: AparelhoOperacionalAllied;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 1200);
    } catch {
      // clipboard indisponível — sem feedback, sem quebrar a tela
    }
  }

  const pecas = aparelho.pecas ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onFechar}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {aparelho.trade_allied}
            {aparelho.os_reparadora && (
              <span className="font-normal" style={{ color: "var(--muted)" }}>
                {" "}
                · OS {aparelho.os_reparadora}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Campo label="OS Care Allied" valor={aparelho.os_care_allied} />
            <Campo label="Modelo comercial" valor={aparelho.modelo_comercial} />
            <Campo label="SKU" valor={aparelho.sku} />
            <Campo label="Descrição" valor={aparelho.descricao_completa} />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
              Peças
            </p>
            {pecas.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Ainda não há peças definidas pra esse atendimento.
              </p>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                      <th className="px-3 py-2 font-medium">Posição</th>
                      <th className="px-3 py-2 font-medium">Part Number</th>
                      <th className="px-3 py-2 font-medium text-right">Venda de Peça</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pecas.map((p, i) => (
                      <tr key={`${p.codigo}-${i}`} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                          {p.posicao}
                        </td>
                        <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                          <div className="flex items-center gap-1.5">
                            {p.codigo}
                            {p.codigo && (
                              <button
                                type="button"
                                onClick={() => copiar(p.codigo!, `${p.codigo}-${i}`)}
                                title="Copiar Part Number"
                                className="inline-flex items-center justify-center w-6 h-6 rounded transition hover:bg-[var(--surface2)]"
                                style={{ color: "var(--muted)" }}
                              >
                                {copiado === `${p.codigo}-${i}` ? (
                                  <Check size={12} style={{ color: "#16a34a" }} />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                          {formatarReal(p.vendaPeca)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Venda total de peças
              </p>
              <p className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                {formatarReal(aparelho.venda_total_pecas)}
              </p>
            </div>
            <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Mão de obra
              </p>
              <p className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                {formatarReal(aparelho.mao_de_obra_cobrada)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p style={{ color: "var(--ink)" }}>{valor || "—"}</p>
    </div>
  );
}
