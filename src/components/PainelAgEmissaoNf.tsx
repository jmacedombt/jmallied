"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { STATUS_AG_NF_RETORNO_RECUSADOS, STATUS_AG_NF_SERVICO_VENDA_RETORNO } from "@/lib/orcamentos";

export type AparelhoAgEmissaoNf = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  pre_ordem: string | null;
  status_operacional: string;
};

const TODOS = "__todos__";

const CORES_STATUS: Record<string, { cor: string; fundo: string }> = {
  [STATUS_AG_NF_RETORNO_RECUSADOS]: { cor: "#f87171", fundo: "rgba(239, 68, 68, 0.14)" },
  [STATUS_AG_NF_SERVICO_VENDA_RETORNO]: { cor: "#34d399", fundo: "rgba(16, 185, 129, 0.14)" },
};

// Tela "Ag. Emissão de Nota Fiscal" — junta os aparelhos que saíram de
// "7 - Reparo Finalizado" (status "Ag. NF Serviço / Venda / Retorno") e
// de "8 - Orçamento Reprovado" (status "Ag. NF Retorno (Recusados)")
// depois do "Emitir NF - Envio de Pré Ordem" de cada etapa. Ainda é só
// consulta — o filtro de Status deixa ver os 2 juntos ou só um dos
// dois. Coluna Pré Ordem em destaque, igual nas 2 telas de origem.
export default function PainelAgEmissaoNf({
  aparelhos,
  topo,
  mensagemVazia = "Nenhum aparelho aguardando emissão de Nota Fiscal no momento.",
}: {
  aparelhos: AparelhoAgEmissaoNf[];
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [statusEscolhido, setStatusEscolhido] = useState(TODOS);

  const filtrados = useMemo(() => {
    const os = buscaOs.trim();
    const trade = buscaTrade.trim().toLowerCase();
    return aparelhos.filter((a) => {
      if (statusEscolhido !== TODOS && a.status_operacional !== statusEscolhido) return false;
      if (os && !(a.os_reparadora ?? "").includes(os)) return false;
      if (trade && !a.trade_allied.toLowerCase().includes(trade)) return false;
      return true;
    });
  }, [aparelhos, buscaOs, buscaTrade, statusEscolhido]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">{topo}</div>

        <div className="flex items-center flex-wrap gap-2">
          <select
            value={statusEscolhido}
            onChange={(e) => setStatusEscolhido(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            aria-label="Filtrar por Status"
          >
            <option value={TODOS}>Todos os status</option>
            <option value={STATUS_AG_NF_SERVICO_VENDA_RETORNO}>{STATUS_AG_NF_SERVICO_VENDA_RETORNO}</option>
            <option value={STATUS_AG_NF_RETORNO_RECUSADOS}>{STATUS_AG_NF_RETORNO_RECUSADOS}</option>
          </select>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaOs}
              onChange={(e) => setBuscaOs(e.target.value)}
              placeholder="Buscar por OS Reparadora"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-48"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaTrade}
              onChange={(e) => setBuscaTrade(e.target.value)}
              placeholder="Buscar por Trade Allied"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-48"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
        </div>
      </div>

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
              <th className="px-4 py-2.5 font-medium" style={{ background: "rgba(250, 204, 21, 0.14)" }}>
                Pré Ordem
              </th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const corStatus = CORES_STATUS[a.status_operacional];
              return (
                <tr
                  key={a.id}
                  className="border-t"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
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
                  <td
                    className="px-4 py-2.5 font-semibold"
                    style={{ background: "rgba(250, 204, 21, 0.14)", color: "var(--ink)" }}
                  >
                    {a.pre_ordem || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: corStatus?.fundo ?? "var(--surface2)", color: corStatus?.cor ?? "var(--muted)" }}
                    >
                      {a.status_operacional}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {aparelhos.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado com esse filtro."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
