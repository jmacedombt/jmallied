"use client";

import { useMemo, useRef, useState } from "react";
import { Lock, Pencil, Save, Search, Unlock, X } from "lucide-react";
import { percentualLucro, type FaixaMarkup, type PecaBidConsulta } from "@/lib/bid";
import TooltipCalculoBid from "@/components/TooltipCalculoBid";

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number | null) {
  if (valor == null) return "—";
  return `${valor >= 0 ? "+" : ""}${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function ordenarSolucoes(peca: PecaBidConsulta) {
  return [...(peca.bid_solucoes ?? [])].sort((a, b) => Number(b.principal) - Number(a.principal));
}

function formatarUltimaAlteracao(data: string, direcao: "+" | "-" | null) {
  const texto = new Date(data).toLocaleDateString("pt-BR");
  if (direcao === "+") return { texto, seta: "▲", cor: "#ef4444" };
  if (direcao === "-") return { texto, seta: "▼", cor: "#22c55e" };
  return { texto, seta: null, cor: "var(--muted)" };
}

type Tooltip = { peca: PecaBidConsulta; x: number; y: number };

export default function ConsultaBidPanel({
  pecasIniciais,
  faixas,
  icmsPercentual,
  podeEditar,
}: {
  pecasIniciais: PecaBidConsulta[];
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  podeEditar: boolean;
}) {
  const [pecas, setPecas] = useState<PecaBidConsulta[]>(pecasIniciais);

  const [filtroPartNumber, setFiltroPartNumber] = useState("");
  const [filtroModelo, setFiltroModelo] = useState("");
  const [filtroSolucao, setFiltroSolucao] = useState("");
  const [somenteTravados, setSomenteTravados] = useState(false);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processandoMassa, setProcessandoMassa] = useState(false);

  const [edicaoId, setEdicaoId] = useState<string | null>(null);
  const [edicaoValor, setEdicaoValor] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [travandoId, setTravandoId] = useState<string | null>(null);

  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const modelosUnicos = useMemo(
    () => Array.from(new Set(pecas.map((p) => p.modelo))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pecas]
  );

  const solucoesUnicas = useMemo(() => {
    const conjunto = new Set<string>();
    for (const p of pecas) for (const s of p.bid_solucoes ?? []) conjunto.add(s.peca_solucao);
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pecas]);

  const pecasFiltradas = useMemo(() => {
    const termo = filtroPartNumber.trim().toLowerCase();
    return pecas.filter((p) => {
      if (termo && !p.part_number.toLowerCase().includes(termo)) return false;
      if (filtroModelo && p.modelo !== filtroModelo) return false;
      if (filtroSolucao && !(p.bid_solucoes ?? []).some((s) => s.peca_solucao === filtroSolucao)) return false;
      if (somenteTravados && !p.travado) return false;
      return true;
    });
  }, [pecas, filtroPartNumber, filtroModelo, filtroSolucao, somenteTravados]);

  const filtroAtivo = Boolean(filtroPartNumber.trim() || filtroModelo || filtroSolucao || somenteTravados);

  const todosFiltradosSelecionados =
    pecasFiltradas.length > 0 && pecasFiltradas.every((p) => selecionados.has(p.id));

  function alternarSelecaoTodos() {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (todosFiltradosSelecionados) {
        for (const p of pecasFiltradas) novo.delete(p.id);
      } else {
        for (const p of pecasFiltradas) novo.add(p.id);
      }
      return novo;
    });
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function acaoEmMassa(travado: boolean) {
    if (selecionados.size === 0) return;
    setProcessandoMassa(true);
    try {
      const res = await fetch("/api/bases/bid/pecas/travar-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selecionados), travado }),
      });
      if (res.ok) {
        const idsAlterados = selecionados;
        setPecas((atual) =>
          atual.map((p) => (idsAlterados.has(p.id) ? { ...p, travado, travado_em: travado ? new Date().toISOString() : null } : p))
        );
        setSelecionados(new Set());
      }
    } finally {
      setProcessandoMassa(false);
    }
  }

  function iniciarEdicao(peca: PecaBidConsulta) {
    setEdicaoId(peca.id);
    setEdicaoValor(peca.custo_peca_allied != null ? String(peca.custo_peca_allied).replace(".", ",") : "");
  }

  function cancelarEdicao() {
    setEdicaoId(null);
    setEdicaoValor("");
  }

  async function salvarEdicao(peca: PecaBidConsulta) {
    const valorNumerico = Number(edicaoValor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNumerico) || valorNumerico < 0) return;

    setSalvandoId(peca.id);
    try {
      const res = await fetch(`/api/bases/bid/pecas/${peca.id}/valor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: valorNumerico }),
      });
      const data = await res.json();
      if (res.ok) {
        setPecas((atual) =>
          atual.map((p) =>
            p.id === peca.id
              ? {
                  ...p,
                  custo_peca_allied: data.custo_peca_allied,
                  valor_com_margem: data.valor_com_margem,
                  valor_imposto: data.valor_imposto ?? null,
                  valor_atualizado_em: data.valor_atualizado_em ?? p.valor_atualizado_em,
                  valor_direcao: data.valor_direcao !== undefined ? data.valor_direcao : p.valor_direcao,
                }
              : p
          )
        );
        cancelarEdicao();
      }
    } finally {
      setSalvandoId(null);
    }
  }

  async function alternarTrava(peca: PecaBidConsulta) {
    setTravandoId(peca.id);
    try {
      const res = await fetch(`/api/bases/bid/pecas/${peca.id}/travar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travado: !peca.travado }),
      });
      if (res.ok) {
        setPecas((atual) =>
          atual.map((p) =>
            p.id === peca.id ? { ...p, travado: !p.travado, travado_em: !p.travado ? new Date().toISOString() : null } : p
          )
        );
      }
    } finally {
      setTravandoId(null);
    }
  }

  function mostrarTooltip(e: React.MouseEvent, peca: PecaBidConsulta) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const largura = 260;
    const x = Math.min(rect.left, Math.max(8, window.innerWidth - largura - 8));
    setTooltip({ peca, x, y: rect.bottom + 8 });
  }

  function ocultarTooltip() {
    setTooltip(null);
  }

  const valorPreviewNumerico = Number(edicaoValor.replace(/\./g, "").replace(",", "."));
  const pecaEmEdicao = pecas.find((p) => p.id === edicaoId) ?? null;
  const lucroPreview =
    pecaEmEdicao && Number.isFinite(valorPreviewNumerico)
      ? percentualLucro(valorPreviewNumerico, pecaEmEdicao.custo_peca_samsung)
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
            Part Number
          </label>
          <Search size={15} className="absolute left-3 top-[38px] -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            type="text"
            value={filtroPartNumber}
            onChange={(e) => setFiltroPartNumber(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          />
        </div>

        <div className="flex-1 min-w-[180px] max-w-xs">
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
            Modelo
          </label>
          <select
            value={filtroModelo}
            onChange={(e) => setFiltroModelo(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          >
            <option value="">Todos</option>
            {modelosUnicos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[220px] max-w-xs">
          <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
            Peça Solução
          </label>
          <select
            value={filtroSolucao}
            onChange={(e) => setFiltroSolucao(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          >
            <option value="">Todas</option>
            {solucoesUnicas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm pb-2.5 cursor-pointer select-none" style={{ color: "var(--ink)" }}>
          <input
            type="checkbox"
            checked={somenteTravados}
            onChange={(e) => setSomenteTravados(e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: "var(--accent2)" }}
          />
          Só travados
        </label>

        {filtroAtivo && (
          <button
            type="button"
            onClick={() => {
              setFiltroPartNumber("");
              setFiltroModelo("");
              setFiltroSolucao("");
              setSomenteTravados(false);
            }}
            className="text-xs pb-3 hover:opacity-80 transition"
            style={{ color: "var(--accent2)" }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          <strong style={{ color: "var(--ink)" }}>{pecasFiltradas.length}</strong> de {pecas.length} peça(s)
          {selecionados.size > 0 ? ` · ${selecionados.size} selecionada(s)` : ""}
        </p>

        {podeEditar && selecionados.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={processandoMassa}
              onClick={() => acaoEmMassa(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition hover:border-[var(--accent2)] disabled:opacity-50"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <Lock size={13} /> Travar selecionados
            </button>
            <button
              type="button"
              disabled={processandoMassa}
              onClick={() => acaoEmMassa(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition hover:border-[var(--accent2)] disabled:opacity-50"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <Unlock size={13} /> Destravar selecionados
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <div ref={scrollRef} onScroll={ocultarTooltip} className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-left">
                {podeEditar && (
                  <th className="sticky top-0 z-10 px-3 py-2.5 w-8" style={{ background: "var(--surface2)" }}>
                    <input
                      type="checkbox"
                      checked={todosFiltradosSelecionados}
                      onChange={alternarSelecaoTodos}
                      className="w-4 h-4"
                      style={{ accentColor: "var(--accent2)" }}
                    />
                  </th>
                )}
                {[
                  "Modelo",
                  "Part Number",
                  "Peça Solução",
                  "Mão de Obra",
                  "Imposto (ICMS)",
                  "Custo Peça (Allied)",
                  "Última alteração",
                ].map((titulo) => (
                  <th
                    key={titulo}
                    className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                    style={{ background: "var(--surface2)", color: "var(--muted)" }}
                  >
                    {titulo}
                  </th>
                ))}
                {podeEditar && (
                  <th className="sticky top-0 z-10 px-4 py-2.5 font-medium text-right" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pecasFiltradas.map((peca) => {
                const principal = ordenarSolucoes(peca)[0];
                const emEdicao = edicaoId === peca.id;

                return (
                  <tr
                    key={peca.id}
                    className="border-t"
                    style={{
                      borderColor: "var(--line)",
                      background: peca.travado ? "var(--accent-glow)" : "var(--surface)",
                    }}
                  >
                    {podeEditar && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selecionados.has(peca.id)}
                          onChange={() => alternarSelecao(peca.id)}
                          className="w-4 h-4"
                          style={{ accentColor: "var(--accent2)" }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {peca.modelo}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--ink)" }}>
                      {peca.part_number}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {principal?.peca_solucao ?? "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {formatarMoeda(peca.mao_de_obra)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {formatarMoeda(peca.valor_imposto)}
                    </td>
                    <td className="px-4 py-2.5 relative">
                      {emEdicao ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={edicaoValor}
                            onChange={(e) => setEdicaoValor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") salvarEdicao(peca);
                              if (e.key === "Escape") cancelarEdicao();
                            }}
                            className="w-28 rounded-md border px-2 py-1 text-sm outline-none focus:border-[var(--accent2)] bg-[var(--surface)] border-[var(--line)]"
                            style={{ color: "var(--ink)" }}
                          />
                          {lucroPreview != null && (
                            <span
                              className="text-[11px]"
                              style={{ color: lucroPreview >= 0 ? "#22c55e" : "#ef4444" }}
                            >
                              Lucro sobre o custo: {formatarPercentual(lucroPreview)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          onMouseEnter={(e) => mostrarTooltip(e, peca)}
                          onMouseLeave={ocultarTooltip}
                          className="inline-flex items-center gap-1.5 font-medium cursor-help border-b border-dashed"
                          style={{ color: "var(--ink)", borderColor: "var(--muted)" }}
                        >
                          {peca.travado && <Lock size={12} style={{ color: "var(--accent2)" }} />}
                          {formatarMoeda(peca.custo_peca_allied)}
                        </span>
                      )}
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
                    {podeEditar && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {emEdicao ? (
                            <>
                              <button
                                type="button"
                                disabled={salvandoId === peca.id}
                                onClick={() => salvarEdicao(peca)}
                                title="Salvar"
                                className="w-7 h-7 flex items-center justify-center rounded-md border transition hover:border-[var(--accent2)] disabled:opacity-50"
                                style={{ borderColor: "var(--line)", color: "var(--accent2)" }}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicao}
                                title="Cancelar"
                                className="w-7 h-7 flex items-center justify-center rounded-md border transition hover:border-[var(--line)]"
                                style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(peca)}
                              title="Editar valor"
                              className="w-7 h-7 flex items-center justify-center rounded-md border transition hover:border-[var(--accent2)]"
                              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                            >
                              <Pencil size={13} />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={travandoId === peca.id}
                            onClick={() => alternarTrava(peca)}
                            title={peca.travado ? "Destravar" : "Travar"}
                            className="w-7 h-7 flex items-center justify-center rounded-md border transition hover:border-[var(--accent2)] disabled:opacity-50"
                            style={{
                              borderColor: "var(--line)",
                              color: peca.travado ? "var(--accent2)" : "var(--muted)",
                            }}
                          >
                            {peca.travado ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {pecasFiltradas.length === 0 && (
                <tr>
                  <td
                    colSpan={podeEditar ? 9 : 7}
                    className="px-4 py-8 text-center"
                    style={{ color: "var(--muted)", background: "var(--surface)" }}
                  >
                    Nenhuma peça encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
