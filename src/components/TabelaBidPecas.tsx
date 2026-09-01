"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, RefreshCcw } from "lucide-react";

export type SolucaoBid = { id: string; peca_solucao: string; principal: boolean };

export type PecaBid = {
  id: string;
  modelo: string;
  part_number: string;
  custo_peca_samsung: number | null;
  custo_peca_allied: number | null;
  mao_de_obra: number | null;
  bid_solucoes: SolucaoBid[];
};

type LinhaHistorico = {
  id: string;
  custo_peca_samsung_anterior: number | null;
  custo_peca_samsung_novo: number | null;
  valor_com_margem_anterior: number | null;
  valor_com_margem_novo: number | null;
  origem: string;
  criado_em: string;
  usuarios: { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
};

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ordenarSolucoes(solucoes: SolucaoBid[]) {
  return [...solucoes].sort((a, b) => Number(b.principal) - Number(a.principal));
}

export default function TabelaBidPecas({ pecas }: { pecas: PecaBid[] }) {
  const router = useRouter();

  const [expandido, setExpandido] = useState<string | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [historicoPorPeca, setHistoricoPorPeca] = useState<Record<string, LinhaHistorico[] | "carregando">>({});

  async function trocarPrincipal(pecaId: string, solucaoId: string) {
    setTrocando(solucaoId);
    try {
      const res = await fetch(`/api/bases/bid/pecas/${pecaId}/principal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solucao_id: solucaoId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setTrocando(null);
      setDropdownAberto(null);
    }
  }

  async function alternarExpandido(pecaId: string) {
    const abrindo = expandido !== pecaId;
    setExpandido(abrindo ? pecaId : null);
    if (abrindo && !historicoPorPeca[pecaId]) {
      setHistoricoPorPeca((h) => ({ ...h, [pecaId]: "carregando" }));
      try {
        const res = await fetch(`/api/bases/bid/pecas/${pecaId}/historico`);
        const data = await res.json();
        setHistoricoPorPeca((h) => ({ ...h, [pecaId]: res.ok ? data.historico : [] }));
      } catch {
        setHistoricoPorPeca((h) => ({ ...h, [pecaId]: [] }));
      }
    }
  }

  if (pecas.length === 0) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
        Nenhuma peça encontrada.
      </p>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left">
              {["Modelo", "Part Number", "Peça Solução", "Custo Peça Samsung", "Mão de Obra", "Custo Peça (Allied)"].map(
                (titulo) => (
                  <th
                    key={titulo}
                    className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                    style={{ background: "var(--surface2)", color: "var(--muted)" }}
                  >
                    {titulo}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {pecas.map((peca) => {
              const solucoes = ordenarSolucoes(peca.bid_solucoes ?? []);
              const principal = solucoes[0];
              const outras = solucoes.slice(1);
              const aberto = expandido === peca.id;
              const historico = historicoPorPeca[peca.id];

              return (
                <Fragment key={peca.id}>
                  <tr
                    onClick={() => alternarExpandido(peca.id)}
                    className="border-t cursor-pointer transition-colors hover:bg-[var(--surface2)]"
                    style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  >
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {peca.modelo}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--ink)" }}>
                      {peca.part_number}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => outras.length > 0 && setDropdownAberto(dropdownAberto === peca.id ? null : peca.id)}
                          className="inline-flex items-center gap-1.5"
                          style={{ color: "var(--ink)", cursor: outras.length > 0 ? "pointer" : "default" }}
                        >
                          {principal?.peca_solucao ?? "—"}
                          {outras.length > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[11px] rounded-full px-1.5 py-0.5"
                              style={{ background: "var(--accent-glow)", color: "var(--accent2)" }}
                            >
                              +{outras.length} <ChevronDown size={11} />
                            </span>
                          )}
                        </button>

                        {dropdownAberto === peca.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setDropdownAberto(null)} />
                            <div
                              className="absolute left-0 top-7 z-40 min-w-[220px] rounded-lg border shadow-2xl overflow-hidden"
                              style={{ background: "var(--surface2)", borderColor: "var(--line)" }}
                            >
                              {solucoes.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  disabled={trocando === s.id}
                                  onClick={() => trocarPrincipal(peca.id, s.id)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface)] transition disabled:opacity-50"
                                  style={{ color: s.principal ? "var(--accent2)" : "var(--ink)" }}
                                >
                                  {s.principal ? "● " : ""}
                                  {s.peca_solucao}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {formatarMoeda(peca.custo_peca_samsung)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {formatarMoeda(peca.mao_de_obra)}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                      {formatarMoeda(peca.custo_peca_allied)}
                    </td>
                  </tr>

                  {aberto && (
                    <tr style={{ background: "var(--surface2)" }}>
                      <td colSpan={6} className="px-4 py-4">
                        <p
                          className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5"
                          style={{ color: "var(--muted)" }}
                        >
                          <Clock size={12} /> Histórico de variação de valor
                        </p>
                        {historico === "carregando" && (
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            Carregando...
                          </p>
                        )}
                        {historico && historico !== "carregando" && historico.length === 0 && (
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            Nenhuma mudança de valor registrada ainda.
                          </p>
                        )}
                        {historico && historico !== "carregando" && historico.length > 0 && (
                          <div className="space-y-1.5">
                            {historico.map((h) => {
                              const usuario = Array.isArray(h.usuarios) ? h.usuarios[0] : h.usuarios;
                              return (
                                <div key={h.id} className="text-xs flex flex-wrap items-center gap-1.5" style={{ color: "var(--ink)" }}>
                                  <span
                                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                                    style={{ background: "var(--surface)", color: "var(--muted)" }}
                                  >
                                    <RefreshCcw size={10} />
                                    {h.origem === "importacao_bid" ? "Importação BID" : "Recálculo"}
                                  </span>
                                  <span>
                                    Custo Peça (Allied): {formatarMoeda(h.valor_com_margem_anterior)} →{" "}
                                    <strong>{formatarMoeda(h.valor_com_margem_novo)}</strong>
                                  </span>
                                  <span style={{ color: "var(--muted)" }}>
                                    ({new Date(h.criado_em).toLocaleString("pt-BR")}
                                    {usuario ? ` · ${usuario.nome} ${usuario.sobrenome}` : ""})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
