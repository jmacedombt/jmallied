"use client";

import { useMemo, useState } from "react";
import { Inbox, PackageCheck, LayoutGrid, ArrowRightLeft } from "lucide-react";
import { STATUS_OPERACIONAL, STATUS_ORCAMENTO_FECHADOS } from "@/lib/orcamentos";
import {
  formatarRotuloPeriodo,
  gerarSequenciaPeriodos,
  completarSerie,
  labelStatus,
  type Granularidade,
  type PontoPeriodo,
  type PontoPeriodoStatus,
  type ContagemStatus,
} from "@/lib/metricas";
import GraficoLinhaGradiente from "@/components/GraficoLinhaGradiente";
import GraficoBarrasCategorias from "@/components/GraficoBarrasCategorias";

type Aba = "reconhecidos" | "entradas" | "finalizados" | "estoque";

const ABAS: { valor: Aba; label: string; icone: typeof Inbox }[] = [
  { valor: "reconhecidos", label: "OS reconhecidas", icone: Inbox },
  { valor: "entradas", label: "Entradas por status", icone: ArrowRightLeft },
  { valor: "finalizados", label: "Finalizadas", icone: PackageCheck },
  { valor: "estoque", label: "Estoque atual", icone: LayoutGrid },
];

const TODOS = "__todos__";

export default function PainelVolumetria({
  granularidade,
  inicio,
  fim,
  reconhecidos,
  entradasPorStatus,
  estoqueAtual,
}: {
  granularidade: Granularidade;
  inicio: string;
  fim: string;
  reconhecidos: PontoPeriodo[];
  entradasPorStatus: PontoPeriodoStatus[];
  estoqueAtual: ContagemStatus[];
}) {
  const [aba, setAba] = useState<Aba>("reconhecidos");
  const [statusEntradas, setStatusEntradas] = useState<string>(TODOS);
  const [statusFinalizados, setStatusFinalizados] = useState<string>(TODOS);

  const periodos = useMemo(() => gerarSequenciaPeriodos(inicio, fim, granularidade), [inicio, fim, granularidade]);

  const statusFechados = STATUS_ORCAMENTO_FECHADOS as readonly string[];
  const entradasFinalizados = useMemo(
    () => entradasPorStatus.filter((p) => statusFechados.includes(p.status)),
    [entradasPorStatus] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function serieDoStatus(dados: PontoPeriodoStatus[], statusEscolhido: string): PontoPeriodo[] {
    const filtrados = statusEscolhido === TODOS ? dados : dados.filter((p) => p.status === statusEscolhido);
    const somaPorPeriodo = new Map<string, number>();
    for (const p of filtrados) {
      somaPorPeriodo.set(p.periodo, (somaPorPeriodo.get(p.periodo) ?? 0) + p.quantidade);
    }
    return Array.from(somaPorPeriodo.entries()).map(([periodo, quantidade]) => ({ periodo, quantidade }));
  }

  const pontosReconhecidos = useMemo(
    () =>
      completarSerie(reconhecidos, periodos).map((p) => ({
        rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
        valor: p.quantidade,
      })),
    [reconhecidos, periodos, granularidade]
  );

  const pontosEntradas = useMemo(
    () =>
      completarSerie(serieDoStatus(entradasPorStatus, statusEntradas), periodos).map((p) => ({
        rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
        valor: p.quantidade,
      })),
    [entradasPorStatus, statusEntradas, periodos, granularidade] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pontosFinalizados = useMemo(
    () =>
      completarSerie(serieDoStatus(entradasFinalizados, statusFinalizados), periodos).map((p) => ({
        rotulo: formatarRotuloPeriodo(p.periodo, granularidade),
        valor: p.quantidade,
      })),
    [entradasFinalizados, statusFinalizados, periodos, granularidade] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const itensEstoque = useMemo(() => {
    const mapa = new Map(estoqueAtual.map((e) => [e.status_operacional, e.quantidade]));
    return STATUS_OPERACIONAL.map((s) => ({ rotulo: s.label, valor: mapa.get(s.valor) ?? 0 }));
  }, [estoqueAtual]);

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

      {aba === "reconhecidos" && (
        <GraficoLinhaGradiente
          titulo="OS reconhecidas por período — quantos aparelhos chegaram na loja (Data Reconhecimento)"
          pontos={pontosReconhecidos}
        />
      )}

      {aba === "entradas" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Status:
            </label>
            <select
              value={statusEntradas}
              onChange={(e) => setStatusEntradas(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={estiloSelect}
            >
              <option value={TODOS}>Todos os status (soma)</option>
              {STATUS_OPERACIONAL.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <GraficoLinhaGradiente
            titulo={`Entradas por período${statusEntradas === TODOS ? " — todos os status" : ` — ${labelStatus(statusEntradas)}`}`}
            pontos={pontosEntradas}
          />
        </div>
      )}

      {aba === "finalizados" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--muted)" }}>
              Status:
            </label>
            <select
              value={statusFinalizados}
              onChange={(e) => setStatusFinalizados(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={estiloSelect}
            >
              <option value={TODOS}>Entregue + Reprovado (soma)</option>
              {STATUS_ORCAMENTO_FECHADOS.map((s) => (
                <option key={s} value={s}>
                  {labelStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <GraficoLinhaGradiente
            titulo={`OS finalizadas por período${statusFinalizados === TODOS ? "" : ` — ${labelStatus(statusFinalizados)}`}`}
            pontos={pontosFinalizados}
            corLinha="#22c55e"
          />
        </div>
      )}

      {aba === "estoque" && (
        <GraficoBarrasCategorias
          titulo="Estoque atual — quantos aparelhos estão parados em cada status agora"
          itens={itensEstoque}
        />
      )}
    </div>
  );
}
