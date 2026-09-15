"use client";

import { useState } from "react";
import PopupAtendimentoPecasAllied from "@/components/PopupAtendimentoPecasAllied";
import { type AparelhoOperacionalAllied } from "@/lib/allied";

type GrupoAllied = { status: string; titulo: string; cor: string };

function TabelaAparelhosAllied({
  aparelhos,
  mensagemVazia,
  onAbrirDetalhe,
}: {
  aparelhos: AparelhoOperacionalAllied[];
  mensagemVazia: string;
  onAbrirDetalhe: (a: AparelhoOperacionalAllied) => void;
}) {
  return (
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
              onClick={() => onAbrirDetalhe(a)}
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
  );
}

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
  agrupar,
}: {
  aparelhos: AparelhoOperacionalAllied[];
  mensagemVazia?: string;
  /** Quando informado, separa os aparelhos em blocos com título por
   * status_operacional em vez de uma tabela única — usado só em "Ag.
   * Emissão de Nota Fiscal", a única etapa que junta 2 status_operacional
   * REAIS diferentes (ver GRUPO_STATUS_AG_EMISSAO_NF em lib/orcamentos.ts)
   * e que o pedido do parceiro foi mostrar já organizado em
   * Aprovados/Recusados. Clicar em qualquer linha, de qualquer bloco,
   * abre o mesmo pop-up (mesmas regras de acesso a dado das demais
   * telas do ALLIED). */
  agrupar?: GrupoAllied[];
}) {
  const [detalhe, setDetalhe] = useState<AparelhoOperacionalAllied | null>(null);

  if (agrupar && agrupar.length > 0) {
    const grupos = agrupar.map((g) => ({
      ...g,
      itens: aparelhos.filter((a) => a.status_operacional === g.status),
    }));
    const semNenhum = grupos.every((g) => g.itens.length === 0);

    return (
      <>
        <div className="space-y-6">
          {semNenhum && (
            <p className="text-sm py-8 text-center rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
              {mensagemVazia}
            </p>
          )}
          {grupos.map(
            (g) =>
              g.itens.length > 0 && (
                <div key={g.status} className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: g.cor }} />
                    {g.titulo}
                    <span className="font-normal" style={{ color: "var(--muted)" }}>
                      ({g.itens.length})
                    </span>
                  </p>
                  <TabelaAparelhosAllied aparelhos={g.itens} mensagemVazia={mensagemVazia} onAbrirDetalhe={setDetalhe} />
                </div>
              )
          )}
        </div>

        {detalhe && <PopupAtendimentoPecasAllied aparelho={detalhe} onFechar={() => setDetalhe(null)} />}
      </>
    );
  }

  return (
    <>
      <TabelaAparelhosAllied aparelhos={aparelhos} mensagemVazia={mensagemVazia} onAbrirDetalhe={setDetalhe} />
      {detalhe && <PopupAtendimentoPecasAllied aparelho={detalhe} onFechar={() => setDetalhe(null)} />}
    </>
  );
}
