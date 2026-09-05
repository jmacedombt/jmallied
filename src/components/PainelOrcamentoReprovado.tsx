"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import PopupPecasOrcamento, { type AparelhoComPecas } from "@/components/PopupPecasOrcamento";
import { formatarDataHoraBrasilia } from "@/lib/tempo";
import { type FaixaMarkup, type InfoBidPeca } from "@/lib/bid";

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

export type AparelhoReprovado = AparelhoComPecas & {
  id: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  motivo_reprova: string | null;
  reprovado_em: string | null;
  usuarios: Usuario;
};

function nomeUsuario(usuarios: Usuario): string | null {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : null;
}

// Tela de "8 - Orçamento Reprovado" — mesmo formato/campos de busca e
// tabela da tela "2 - Ag. Análise" (ver PainelAgAnalise.tsx), com a
// justificativa e quem/quando reprovou no lugar da coluna de Ação (aqui
// já não tem mais ação nenhuma pra fazer, é etapa final).
export default function PainelOrcamentoReprovado({
  aparelhos,
  topo,
  precosBidIniciais = {},
  faixas = [],
  icmsPercentual = 0,
  podeCadastrarBid = false,
  mensagemVazia = "Nenhum orçamento reprovado no momento.",
}: {
  aparelhos: AparelhoReprovado[];
  topo: React.ReactNode;
  precosBidIniciais?: Record<string, InfoBidPeca>;
  faixas?: FaixaMarkup[];
  icmsPercentual?: number;
  podeCadastrarBid?: boolean;
  mensagemVazia?: string;
}) {
  const [precosBid, setPrecosBid] = useState(precosBidIniciais);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [detalhe, setDetalhe] = useState<AparelhoReprovado | null>(null);

  const filtrados = useMemo(() => {
    const os = buscaOs.trim();
    const trade = buscaTrade.trim().toLowerCase();
    return aparelhos.filter((a) => {
      if (os && !(a.os_reparadora ?? "").includes(os)) return false;
      if (trade && !a.trade_allied.toLowerCase().includes(trade)) return false;
      return true;
    });
  }, [aparelhos, buscaOs, buscaTrade]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">{topo}</div>

        <div className="flex items-center flex-wrap gap-2">
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
              <th className="px-4 py-2.5 font-medium">Motivo</th>
              <th className="px-4 py-2.5 font-medium">Reprovado em</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr
                key={a.id}
                onClick={() => setDetalhe(a)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver as peças lançadas nesse orçamento"
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
                <td className="px-4 py-2.5" style={{ color: "#ef4444" }} title={a.motivo_reprova ?? ""}>
                  {a.motivo_reprova || "—"}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                  {a.reprovado_em ? (
                    <>
                      {formatarDataHoraBrasilia(a.reprovado_em)}
                      {nomeUsuario(a.usuarios) && <> · {nomeUsuario(a.usuarios)}</>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)", background: "var(--surface)" }}
                >
                  {aparelhos.length === 0 ? mensagemVazia : "Nenhum orçamento encontrado com essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Clique numa linha pra ver as peças lançadas nesse orçamento.
      </p>

      {detalhe && (
        <PopupPecasOrcamento
          aparelho={detalhe}
          precosBid={precosBid}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          podeCadastrar={podeCadastrarBid}
          onPecaAtualizada={(info) => setPrecosBid((atual) => ({ ...atual, [info.part_number]: info }))}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}
