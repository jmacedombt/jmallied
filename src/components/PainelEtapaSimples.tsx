"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupAtendimentoPecas from "@/components/PopupAtendimentoPecas";
import { type DetalheValidacaoOrcamento } from "@/lib/orcamentos";

export type AparelhoEtapaSimples = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

// Tabela de consulta genérica usada pelas etapas do Operacional que
// ainda não têm uma tela própria (4 - Ag. Resposta de Reorçamento,
// OQC - Controle de Qualidade, 7 - Reparo Finalizado, e Produto
// Entregue) — a lista dos aparelhos, com o ícone de reprovar quando
// `permiteReprovar` (não faz sentido reprovar um orçamento que já foi
// entregue), e clique na linha abrindo o mesmo pop-up de
// atendimento/peças de 5 - Ag. Peças e 6 - Ag. Reparo.
export default function PainelEtapaSimples({
  aparelhos,
  permiteReprovar,
  mensagemVazia = "Nenhum aparelho nessa etapa ainda.",
}: {
  aparelhos: AparelhoEtapaSimples[];
  permiteReprovar: boolean;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const [detalhe, setDetalhe] = useState<AparelhoEtapaSimples | null>(null);

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
              {permiteReprovar && <th className="px-4 py-2.5 font-medium text-right">Ação</th>}
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
                {permiteReprovar && (
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setReprovando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })}
                      title="Reprovar orçamento"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444]"
                      style={{ borderColor: "var(--line)", color: "#ef4444" }}
                    >
                      <Ban size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {aparelhos.length === 0 && (
              <tr>
                <td
                  colSpan={permiteReprovar ? 7 : 6}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)", background: "var(--surface)" }}
                >
                  {mensagemVazia}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reprovando && (
        <PopupReprovarOrcamento
          aparelho={reprovando}
          onFechar={() => setReprovando(null)}
          onReprovado={() => {
            setReprovando(null);
            router.refresh();
          }}
        />
      )}

      {detalhe && <PopupAtendimentoPecas aparelho={detalhe} onFechar={() => setDetalhe(null)} />}
    </>
  );
}
