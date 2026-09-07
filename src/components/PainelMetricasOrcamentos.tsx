"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Layers, Search, ShoppingBag, XCircle } from "lucide-react";
import {
  RESULTADOS_ORCAMENTO,
  agruparResultadoPorLote,
  agruparResultadoPorModelo,
  agruparRankingPecas,
  corResultado,
  formatarPercentual,
  formatarReal,
  labelResultado,
  resumirResultados,
  type LinhaResultadoOrcamento,
  type LinhaResultadoPeca,
  type ResultadoOrcamento,
} from "@/lib/metricas";
import GraficoBarrasCategorias from "@/components/GraficoBarrasCategorias";

type Aba = "resumo" | "lote" | "modelo" | "peca";

const ABAS: { valor: Aba; label: string; icone: typeof Layers }[] = [
  { valor: "resumo", label: "Resumo geral", icone: Layers },
  { valor: "lote", label: "Por lote (NF Remessa)", icone: ShoppingBag },
  { valor: "modelo", label: "Por modelo", icone: CheckCircle2 },
  { valor: "peca", label: "Por Part Number", icone: XCircle },
];

type OrdemRanking = "reprovacao" | "aprovacao" | "volume";

const OPCOES_ORDEM: { valor: OrdemRanking; label: string }[] = [
  { valor: "reprovacao", label: "Mais reprovado" },
  { valor: "aprovacao", label: "Mais aprovado" },
  { valor: "volume", label: "Mais orçamentos" },
];

function contagemAprovados(porResultado: Record<ResultadoOrcamento, number>): number {
  return porResultado.aprovado_primeira + porResultado.contra_proposta_aceita;
}

function contagemReprovados(porResultado: Record<ResultadoOrcamento, number>): number {
  return porResultado.reprovado_primeira + porResultado.contra_proposta_recusada;
}

export default function PainelMetricasOrcamentos({
  linhas,
  linhasPeca,
}: {
  linhas: LinhaResultadoOrcamento[];
  linhasPeca: LinhaResultadoPeca[];
}) {
  const [aba, setAba] = useState<Aba>("resumo");
  const [buscaLote, setBuscaLote] = useState("");
  const [ordemModelo, setOrdemModelo] = useState<OrdemRanking>("reprovacao");
  const [ordemPeca, setOrdemPeca] = useState<OrdemRanking>("reprovacao");

  const resumo = useMemo(() => resumirResultados(linhas), [linhas]);
  const porLote = useMemo(() => agruparResultadoPorLote(linhas), [linhas]);
  const porModelo = useMemo(() => agruparResultadoPorModelo(linhas), [linhas]);
  const rankingPecas = useMemo(() => agruparRankingPecas(linhasPeca), [linhasPeca]);

  const lotesFiltrados = useMemo(() => {
    const busca = buscaLote.trim().toLowerCase();
    if (!busca) return porLote;
    return porLote.filter((l) => l.nfRemessaAllied.toLowerCase().includes(busca));
  }, [porLote, buscaLote]);

  const modelosOrdenados = useMemo(() => {
    const copia = [...porModelo];
    if (ordemModelo === "reprovacao") copia.sort((a, b) => contagemReprovados(b.porResultado) - contagemReprovados(a.porResultado));
    else if (ordemModelo === "aprovacao") copia.sort((a, b) => contagemAprovados(b.porResultado) - contagemAprovados(a.porResultado));
    return copia.slice(0, 12);
  }, [porModelo, ordemModelo]);

  const itensGraficoModelo = useMemo(
    () =>
      modelosOrdenados.map((m) => {
        const valor = ordemModelo === "aprovacao" ? contagemAprovados(m.porResultado) : contagemReprovados(m.porResultado);
        return { rotulo: m.modeloComercial, valor, total: m.total };
      }),
    [modelosOrdenados, ordemModelo]
  );

  // peças com só 1 ou 2 ocorrências distorcem o % de reprovação (uma
  // única peça reprovada já vira "100% de reprovação") — corta esse
  // ruído fora do ranking por volume também, não só do texto.
  const PECAS_MIN_OCORRENCIAS = 3;
  const pecasComVolume = useMemo(() => rankingPecas.filter((p) => p.total >= PECAS_MIN_OCORRENCIAS), [rankingPecas]);

  const pecasOrdenadas = useMemo(() => {
    const copia = [...pecasComVolume];
    if (ordemPeca === "reprovacao") copia.sort((a, b) => contagemReprovados(b.porResultado) - contagemReprovados(a.porResultado));
    else if (ordemPeca === "aprovacao") copia.sort((a, b) => contagemAprovados(b.porResultado) - contagemAprovados(a.porResultado));
    return copia.slice(0, 15);
  }, [pecasComVolume, ordemPeca]);

  const itensGraficoPeca = useMemo(
    () =>
      pecasOrdenadas.map((p) => {
        const valor = ordemPeca === "aprovacao" ? contagemAprovados(p.porResultado) : contagemReprovados(p.porResultado);
        return { rotulo: p.partNumber, valor, total: p.total };
      }),
    [pecasOrdenadas, ordemPeca]
  );

  const estiloSelect: React.CSSProperties = {
    borderColor: "var(--line)",
    background: "var(--surface2)",
    color: "var(--ink)",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => {
          const Icone = a.icone;
          const ativo = aba === a.valor;
          return (
            <button
              key={a.valor}
              type="button"
              onClick={() => setAba(a.valor)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition"
              style={
                ativo
                  ? { background: "var(--accent-glow)", color: "var(--accent2)", borderColor: "var(--accent2)" }
                  : { color: "var(--muted)", borderColor: "var(--line)" }
              }
            >
              <Icone size={13} />
              {a.label}
            </button>
          );
        })}
      </div>

      {aba === "resumo" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {RESULTADOS_ORCAMENTO.map((r) => (
              <div
                key={r.valor}
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
                  {r.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: r.cor }}>
                  {resumo.porResultado[r.valor]}
                  <span className="text-xs font-normal ml-2" style={{ color: "var(--muted)" }}>
                    {formatarPercentual(resumo.percentualPorResultado[r.valor])}
                  </span>
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {resumo.valorMedioPorResultado[r.valor] != null
                    ? `Valor médio: ${formatarReal(resumo.valorMedioPorResultado[r.valor]!)}`
                    : "Sem valor apurado"}
                </p>
              </div>
            ))}
          </div>

          <div
            className="inline-flex items-center gap-4 rounded-xl border px-5 py-4"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                % de aprovação geral no período (aprovado de primeira + contra proposta aceita)
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--accent2)" }}>
                {formatarPercentual(resumo.percentualAprovacaoGeral)}
                <span className="text-xs font-normal ml-2" style={{ color: "var(--muted)" }}>
                  · {resumo.total} orçamento(s) fechado(s)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {aba === "lote" && (
        <div className="space-y-3">
          <div className="relative w-64">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaLote}
              onChange={(e) => setBuscaLote(e.target.value)}
              placeholder="Buscar por NF Remessa"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-full"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>

          <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">NF Remessa</th>
                  {RESULTADOS_ORCAMENTO.map((r) => (
                    <th key={r.valor} className="px-4 py-2.5 font-medium text-right" style={{ color: r.cor }}>
                      {r.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium text-right">% Aprovação</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.map((l) => (
                  <tr
                    key={l.nfRemessaAllied}
                    className="border-t"
                    style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                      {l.nfRemessaAllied}
                    </td>
                    {RESULTADOS_ORCAMENTO.map((r) => (
                      <td key={r.valor} className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                        {l.porResultado[r.valor]}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                      {l.total}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--accent2)" }}>
                      {formatarPercentual(l.percentualAprovacao)}
                    </td>
                  </tr>
                ))}
                {lotesFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={RESULTADOS_ORCAMENTO.length + 3}
                      className="px-4 py-8 text-center"
                      style={{ color: "var(--muted)", background: "var(--surface)" }}
                    >
                      {porLote.length === 0
                        ? "Nenhum orçamento fechado no período selecionado."
                        : "Nenhum lote encontrado com essa busca."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === "modelo" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Ordenar por:
            </label>
            <select
              value={ordemModelo}
              onChange={(e) => setOrdemModelo(e.target.value as OrdemRanking)}
              className="rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={estiloSelect}
            >
              {OPCOES_ORDEM.filter((o) => o.valor !== "volume").map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <GraficoBarrasCategorias
            titulo={
              ordemModelo === "aprovacao"
                ? "Modelos comerciais com mais orçamentos aprovados (top 12)"
                : "Modelos comerciais com mais orçamentos reprovados (top 12)"
            }
            itens={itensGraficoModelo.map((i) => ({ rotulo: i.rotulo, valor: i.valor, valorExibido: `${i.valor} de ${i.total}` }))}
            cor={ordemModelo === "aprovacao" ? "#22c55e" : "#ef4444"}
            mensagemVazia="Nenhum orçamento fechado no período selecionado."
          />
        </div>
      )}

      {aba === "peca" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Ordenar por:
            </label>
            <select
              value={ordemPeca}
              onChange={(e) => setOrdemPeca(e.target.value as OrdemRanking)}
              className="rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={estiloSelect}
            >
              {OPCOES_ORDEM.filter((o) => o.valor !== "volume").map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <GraficoBarrasCategorias
            titulo={
              ordemPeca === "aprovacao"
                ? "Part Number com mais orçamentos aprovados (top 15, só peças com 3+ ocorrências no período)"
                : "Part Number com mais orçamentos reprovados (top 15, só peças com 3+ ocorrências no período)"
            }
            itens={itensGraficoPeca.map((i) => ({ rotulo: i.rotulo, valor: i.valor, valorExibido: `${i.valor} de ${i.total}` }))}
            cor={ordemPeca === "aprovacao" ? "#22c55e" : "#ef4444"}
            mensagemVazia="Nenhuma peça com ocorrência suficiente no período selecionado."
          />
        </div>
      )}
    </div>
  );
}
