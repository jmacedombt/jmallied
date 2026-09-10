"use client";

import { useState } from "react";
import PopupAtendimentoPecasAllied from "@/components/PopupAtendimentoPecasAllied";
import { type AparelhoOperacionalAllied } from "@/lib/allied";

/**
 * Tabela de consulta usada em TODAS as etapas do Operacional pro cargo
 * ALLIED (login externo, só consulta) — uma única tela genérica em vez
 * de reaproveitar os painéis internos (2-Ag-Análise, 5-Ag-Peças etc.),
 * porque nenhum deles tem botão de ação nem seleção em massa aqui: sem
 * "Confirmar", sem "Reprovar", sem "Pedido feito" — só ver a lista e
 * clicar na linha pra abrir peças/valores desse atendimento.
 */
export default function PainelOperacionalAllied({
  aparelhos,
  mensagemVazia = "Nenhum aparelho nessa etapa ainda.",
}: {
  aparelhos: AparelhoOperacionalAllied[];
  mensagemVazia?: string;
}) {
  const [detalhe, setDetalhe] = useState<AparelhoOperacionalAllied | null>(null);

  return (
    <>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">Trade Allied</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {aparelhos.map((a) => (
              <tr
                key={a.id}
                onClick={() => setDetalhe(a)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver as peças e valores desse atendimento"
              >
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {a.os_reparadora || "—"}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                  {a.trade_allied}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {a.os_care_allied}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {a.modelo_comercial}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {a.sku}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }} title={a.descricao_completa ?? ""}>
                  {(a.descricao_completa ?? "").split(" ")[0]}
                </td>
              </tr>
            ))}
            {aparelhos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {mensagemVazia}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalhe && <PopupAtendimentoPecasAllied aparelho={detalhe} onFechar={() => setDetalhe(null)} />}
    </>
  );
}
