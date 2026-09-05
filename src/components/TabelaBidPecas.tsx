"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, Lock, RefreshCcw } from "lucide-react";
import { type FaixaMarkup } from "@/lib/bid";
import { formatarDataBrasilia, formatarDataHoraBrasilia } from "@/lib/tempo";
import TooltipCalculoBid from "@/components/TooltipCalculoBid";

export type SolucaoBid = { id: string; peca_solucao: string; principal: boolean };

export type PecaBid = {
  id: string;
  modelo: string;
  part_number: string;
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
  custo_peca_allied: number | null;
  valor_imposto: number | null;
  mao_de_obra: number | null;
  travado: boolean;
  valor_atualizado_em: string;
  valor_direcao: "+" | "-" | null;
  bid_solucoes: SolucaoBid[];
};

type LinhaHistorico = {
  id: string;
  custo_peca_samsung_anterior: number | null;
  custo_peca_samsung_novo: number | null;
  valor_com_margem_anterior: number | null;
  valor_com_margem_novo: number | null;
  custo_peca_allied_anterior: number | null;
  custo_peca_allied_novo: number | null;
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

function formatarUltimaAlteracao(data: string, direcao: "+" | "-" | null) {
  const texto = formatarDataBrasilia(data);
  if (direcao === "+") return { texto, seta: "▲", cor: "#ef4444" };
  if (direcao === "-") return { texto, seta: "▼", cor: "#22c55e" };
  return { texto, seta: null as string | null, cor: "var(--muted)" };
}

type Tooltip = { peca: PecaBid; x: number; y: number };

export default function TabelaBidPecas({
  pecas,
  faixas = [],
  icmsPercentual = 0,
  partNumbersPrioritarios,
}: {
  pecas: PecaBid[];
  faixas?: FaixaMarkup[];
  icmsPercentual?: number;
  /** Part Numbers referenciados por algum pedido em aberto — exibidos em
   * destaque (vermelho) e vêm primeiro na lista, já que o cadastro deles
   * no BID é mais urgente. Usado só em Pendências BID. */
  partNumbersPrioritarios?: Set<string>;
}) {
  const router = useRouter();

  const [expandido, setExpandido] = useState<string | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [historicoPorPeca, setHistoricoPorPeca] = useState<Record<string, LinhaHistorico[] | "carregando">>({});
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function mostrarTooltip(e: React.MouseEvent, peca: PecaBid) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const largura = 260;
    const x = Math.min(rect.left, Math.max(8, window.innerWidth - largura - 8));
    setTooltip({ peca, x, y: rect.bottom + 8 });
  }

  function ocultarTooltip() {
    setTooltip(null);
  }

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

  // altura vem do container pai (que reserva exatamente o espaço
  // sobrando na tela via flex) em vez de um "calc(100vh - Npx)" chutado
  // — isso é o que evita a barra de rolagem dupla (a da página + a da
  // tabela) quando a tela tem mais ou menos conteúdo acima da tabela.
  return (
    <div className="h-full flex flex-col rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
      <div ref={scrollRef} onScroll={ocultarTooltip} className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left">
              {[
                "Modelo",
                "Part Number",
                "Peça Solução",
                "Custo Peça Samsung",
                "Mão de Obra",
                "Imposto (ICMS)",
                "Custo Peça (Allied)",
                "Última alteração",
              ].map(
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
              const prioritaria = partNumbersPrioritarios?.has(peca.part_number) ?? false;

              return (
                <Fragment key={peca.id}>
                  <tr
                    onClick={() => alternarExpandido(peca.id)}
                    className="border-t cursor-pointer transition-colors hover:bg-[var(--surface2)]"
                    style={{
                      borderColor: "var(--line)",
                      background: prioritaria ? "rgba(239, 68, 68, 0.07)" : "var(--surface)",
                    }}
                  >
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {peca.modelo}
                    </td>
                    <td
                      className="px-4 py-2.5 font-mono"
                      style={{ color: prioritaria ? "#ef4444" : "var(--ink)", fontWeight: prioritaria ? 600 : 400 }}
                      title={prioritaria ? "Existe pedido em aberto esperando o cadastro dessa peça no BID" : undefined}
                    >
                      {peca.part_number}
                      {prioritaria && (
                        <span
                          className="ml-2 inline-block text-[10px] font-sans font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 align-middle"
                          style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
                        >
                          Prioridade
                        </span>
                      )}
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
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {formatarMoeda(peca.valor_imposto)}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <span
                        onMouseEnter={(e) => mostrarTooltip(e, peca)}
                        onMouseLeave={ocultarTooltip}
                        className="inline-flex items-center gap-1.5 font-medium cursor-help border-b border-dashed"
                        style={{ color: "var(--ink)", borderColor: "var(--muted)" }}
                      >
                        {peca.travado && <Lock size={12} style={{ color: "var(--accent2)" }} />}
                        {formatarMoeda(peca.custo_peca_allied)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {(() => {
                        const { texto, seta, cor } = formatarUltimaAlteracao(peca.valor_atualizado_em, peca.valor_direcao);
                        return (
                          <span className="inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
                            {texto}
                            {seta && <span style={{ color: cor }}>{seta}</span>}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {aberto && (
                    <tr style={{ background: "var(--surface2)" }}>
                      <td colSpan={8} className="px-4 py-4">
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
                              // linhas de histórico antigas (de antes do imposto entrar no
                              // cálculo) não têm custo_peca_allied_anterior/novo — nesse caso
                              // valor_com_margem_* já era o valor final, então serve de fallback.
                              const anterior = h.custo_peca_allied_anterior ?? h.valor_com_margem_anterior;
                              const novo = h.custo_peca_allied_novo ?? h.valor_com_margem_novo;
                              const aumentou = anterior != null && novo != null && novo > anterior;
                              const diminuiu = anterior != null && novo != null && novo < anterior;
                              return (
                                <div key={h.id} className="text-xs flex flex-wrap items-center gap-1.5" style={{ color: "var(--ink)" }}>
                                  <span
                                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                                    style={{ background: "var(--surface)", color: "var(--muted)" }}
                                  >
                                    <RefreshCcw size={10} />
                                    {h.origem === "importacao_bid"
                                      ? "Importação BID"
                                      : h.origem === "edicao_manual"
                                        ? "Edição manual"
                                        : "Recálculo"}
                                  </span>
                                  <span>
                                    Custo Peça (Allied): {formatarMoeda(anterior)} →{" "}
                                    <strong>{formatarMoeda(novo)}</strong>{" "}
                                    {aumentou && <span style={{ color: "#ef4444" }}>▲</span>}
                                    {diminuiu && <span style={{ color: "#22c55e" }}>▼</span>}
                                  </span>
                                  <span style={{ color: "var(--muted)" }}>
                                    ({formatarDataHoraBrasilia(h.criado_em)}
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

      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border shadow-2xl p-3"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", left: tooltip.x, top: tooltip.y }}
        >
          <TooltipCalculoBid peca={tooltip.peca} faixas={faixas} icmsPercentual={icmsPercentual} />
        </div>
      )}
    </div>
  );
}
