"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Layers, Search, ShoppingBag, TrendingUp } from "lucide-react";
import {
  agruparOqcPorLote,
  agruparReincidenciaOqc,
  formatarPercentual,
  formatarRotuloPeriodo,
  gerarSequenciaPeriodos,
  resumirOqc,
  serieOqcDoResultado,
  type Granularidade,
  type LinhaOqc,
  type PontoPeriodoOqc,
} from "@/lib/metricas";
import { formatarDataHoraBrasilia } from "@/lib/tempo";
import GraficoLinhaGradiente from "@/components/GraficoLinhaGradiente";

type Aba = "resumo" | "lote" | "reincidencia" | "evolucao";

const ABAS: { valor: Aba; label: string; icone: typeof Layers }[] = [
  { valor: "resumo", label: "Resumo geral", icone: Layers },
  { valor: "lote", label: "Por lote (NF Remessa)", icone: ShoppingBag },
  { valor: "reincidencia", label: "Reincidência", icone: AlertTriangle },
  { valor: "evolucao", label: "Evolução", icone: TrendingUp },
];

export default function PainelMetricasOqc({
  linhas,
  serie,
  granularidade,
  inicio,
  fim,
}: {
  linhas: LinhaOqc[];
  serie: PontoPeriodoOqc[];
  granularidade: Granularidade;
  inicio: string;
  fim: string;
}) {
  const [aba, setAba] = useState<Aba>("resumo");
  const [buscaLote, setBuscaLote] = useState("");

  const resumo = useMemo(() => resumirOqc(linhas), [linhas]);
  const porLote = useMemo(() => agruparOqcPorLote(linhas), [linhas]);
  const reincidencias = useMemo(() => agruparReincidenciaOqc(linhas), [linhas]);

  const lotesFiltrados = useMemo(() => {
    const busca = buscaLote.trim().toLowerCase();
    if (!busca) return porLote;
    return porLote.filter((l) => l.nfRemessaAllied.toLowerCase().includes(busca));
  }, [porLote, buscaLote]);

  const periodos = useMemo(() => gerarSequenciaPeriodos(inicio, fim, granularidade), [inicio, fim, granularidade]);

  const pontosPass = useMemo(
    () =>
      serieOqcDoResultado(serie, "pass", periodos).map((p) => ({
        rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
        valor: p.quantidade,
      })),
    [serie, periodos, granularidade]
  );

  const pontosFail = useMemo(
    () =>
      serieOqcDoResultado(serie, "fail", periodos).map((p) => ({
        rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
        valor: p.quantidade,
      })),
    [serie, periodos, granularidade]
  );

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
              Avaliados no período
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
              {resumo.total}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
              OQC PASS
            </p>
            <p className="text-2xl font-bold" style={{ color: "#16a34a" }}>
              {resumo.pass}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
              OQC FAIL
            </p>
            <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
              {resumo.fail}
            </p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
              % FAIL (sobre avaliados)
            </p>
            <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
              {formatarPercentual(resumo.percentualFail)}
            </p>
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
                  <th className="px-4 py-2.5 font-medium text-right" style={{ color: "#16a34a" }}>
                    PASS
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right" style={{ color: "#ef4444" }}>
                    FAIL
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right">Total avaliado</th>
                  <th className="px-4 py-2.5 font-medium text-right">% FAIL</th>
                </tr>
              </thead>
              <tbody>
                {lotesFiltrados.map((l) => (
                  <tr key={l.nfRemessaAllied} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                      {l.nfRemessaAllied}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                      {l.pass}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                      {l.fail}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                      {l.total}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: l.percentualFail > 0 ? "#ef4444" : "var(--muted)" }}>
                      {formatarPercentual(l.percentualFail)}
                    </td>
                  </tr>
                ))}
                {lotesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                      {porLote.length === 0 ? "Nenhuma avaliação de OQC no período selecionado." : "Nenhum lote encontrado com essa busca."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === "reincidencia" && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Aparelhos que falharam no OQC mais de uma vez dentro do período selecionado — cada nova falha do mesmo
            orçamento soma na contagem (1x, 2x, 3x...).
          </p>
          <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Trade Allied</th>
                  <th className="px-4 py-2.5 font-medium">NF Remessa</th>
                  <th className="px-4 py-2.5 font-medium text-right">Falhas no período</th>
                  <th className="px-4 py-2.5 font-medium text-right">Última falha</th>
                </tr>
              </thead>
              <tbody>
                {reincidencias.map((r) => (
                  <tr key={r.orcamentoId} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                      {r.tradeAllied ?? "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {r.nfRemessaAllied ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: "rgba(239, 68, 68, 0.14)", color: "#ef4444" }}
                      >
                        {r.quantidadeFail}x
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                      {formatarDataHoraBrasilia(r.ultimaFalhaEm)}
                    </td>
                  </tr>
                ))}
                {reincidencias.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                      Nenhum aparelho com mais de uma falha no OQC nesse período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === "evolucao" && (
        <div className="space-y-4">
          <GraficoLinhaGradiente titulo="OQC PASS por período" pontos={pontosPass} corLinha="#16a34a" />
          <GraficoLinhaGradiente titulo="OQC FAIL por período" pontos={pontosFail} corLinha="#ef4444" />
        </div>
      )}
    </div>
  );
}
