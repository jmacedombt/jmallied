"use client";

import { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";
import {
  formatarRotuloPeriodo,
  formatarDias,
  labelStatus,
  type Granularidade,
  type PontoRTatTotal,
  type PontoRTatStatus,
} from "@/lib/metricas";
import GraficoLinhaGradiente from "@/components/GraficoLinhaGradiente";

export default function PainelRTat({
  granularidade,
  rtatTotal,
  rtatPorStatus,
}: {
  granularidade: Granularidade;
  inicio: string;
  fim: string;
  rtatTotal: PontoRTatTotal[];
  rtatPorStatus: PontoRTatStatus[];
}) {
  const [statusEscolhido, setStatusEscolhido] = useState<string>(STATUS_OPERACIONAL[0].valor);

  // média geral do período inteiro — pondera pela quantidade de cada
  // bucket, não é a média simples dos buckets (um bucket com 40
  // aparelhos pesa mais que um com 2).
  const mediaGeral = useMemo(() => {
    const somaPonderada = rtatTotal.reduce((soma, p) => soma + p.tat_medio_dias * p.quantidade, 0);
    const totalQuantidade = rtatTotal.reduce((soma, p) => soma + p.quantidade, 0);
    return totalQuantidade > 0 ? somaPonderada / totalQuantidade : 0;
  }, [rtatTotal]);

  const totalAparelhos = useMemo(() => rtatTotal.reduce((soma, p) => soma + p.quantidade, 0), [rtatTotal]);

  const pontosTotal = useMemo(
    () =>
      rtatTotal.map((p) => ({
        rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
        valor: p.tat_medio_dias,
      })),
    [rtatTotal, granularidade]
  );

  const pontosPorStatus = useMemo(
    () =>
      rtatPorStatus
        .filter((p) => p.status === statusEscolhido)
        .map((p) => ({
          rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
          valor: p.tat_medio_dias,
        })),
    [rtatPorStatus, statusEscolhido, granularidade]
  );

  const estiloSelect: React.CSSProperties = {
    borderColor: "var(--line)",
    background: "var(--surface2)",
    color: "var(--ink)",
  };

  return (
    <div className="space-y-4">
      <div
        className="inline-flex items-center gap-4 rounded-xl border px-5 py-4"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <Gauge size={28} style={{ color: "var(--accent2)" }} />
        <div>
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            R-TAT médio no período (Data Reconhecimento até fechar, ou até hoje se em aberto)
          </p>
          <p className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
            {formatarDias(mediaGeral)}
            <span className="text-xs font-normal ml-2" style={{ color: "var(--muted)" }}>
              · {totalAparelhos} aparelho(s) reconhecido(s)
            </span>
          </p>
        </div>
      </div>

      <GraficoLinhaGradiente titulo="R-TAT total médio por período" pontos={pontosTotal} formatarValor={formatarDias} />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            R-TAT por status:
          </label>
          <select
            value={statusEscolhido}
            onChange={(e) => setStatusEscolhido(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none"
            style={estiloSelect}
          >
            {STATUS_OPERACIONAL.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <GraficoLinhaGradiente
          titulo={`Tempo médio parado em "${labelStatus(statusEscolhido)}" por período`}
          pontos={pontosPorStatus}
          formatarValor={formatarDias}
          corLinha="#f59e0b"
          mensagemVazia="Nenhum aparelho passou (ou está) nesse status no período — ou ele ainda não tem histórico registrado (só passa a ter a partir da próxima mudança de status depois que esse recurso entrou no ar)."
        />
      </div>
    </div>
  );
}
