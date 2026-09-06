"use client";

import { useMemo, useState } from "react";
import GraficoLinhaGradiente from "@/components/GraficoLinhaGradiente";

type PontoPeriodo = { periodo: string; quantidade: number };

type Agrupamento = "mes" | "semana" | "ano";

const OPCOES: { valor: Agrupamento; label: string }[] = [
  { valor: "mes", label: "Mês" },
  { valor: "semana", label: "Semana" },
  { valor: "ano", label: "Ano" },
];

// quantos pontos (mais recentes) cada agrupamento mostra — "ano" não é
// limitado porque dificilmente uma base acumula mais que uns poucos anos
const JANELA: Record<Agrupamento, number | null> = {
  mes: 12,
  semana: 15,
  ano: null,
};

/** Número da semana ISO-8601 (segunda-feira como início), igual ao que
 * o Postgres usa em date_trunc('week', ...) — por isso bate certinho
 * com o agrupamento que já vem do banco. Mesma conta usada em
 * lib/metricas.ts (menu Métricas). */
function semanaIso(data: Date): number {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7; // domingo (0) vira 7
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

function formatarRotulo(periodoIso: string, agrupamento: Agrupamento): string {
  const d = new Date(`${periodoIso}T00:00:00`);
  if (agrupamento === "ano") return String(d.getFullYear());
  if (agrupamento === "semana") {
    return `W${semanaIso(d)}`;
  }
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

// Mesmo formato de gráfico do menu Métricas > Volumetria (linha com área
// em degradê e o valor de cada ponto escrito acima dele) — trocado do
// desenho em barras 3D que existia aqui antes, pra manter os gráficos do
// sistema todos com a mesma cara.
export default function GraficoPecasPorPeriodo({
  porMes,
  porSemana,
  porAno,
}: {
  porMes: PontoPeriodo[];
  porSemana: PontoPeriodo[];
  porAno: PontoPeriodo[];
}) {
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("mes");

  const bruto = agrupamento === "mes" ? porMes : agrupamento === "semana" ? porSemana : porAno;
  const janela = JANELA[agrupamento];
  const dados = janela ? bruto.slice(-janela) : bruto;

  const pontos = useMemo(
    () => dados.map((d) => ({ rotulo: formatarRotulo(d.periodo, agrupamento), valor: d.quantidade })),
    [dados, agrupamento]
  );

  return (
    <GraficoLinhaGradiente
      titulo="Peças registradas por período"
      acoes={
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          {OPCOES.map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setAgrupamento(op.valor)}
              className="px-3 py-1.5 text-xs font-medium transition"
              style={
                agrupamento === op.valor
                  ? { background: "var(--surface2)", color: "var(--ink)" }
                  : { color: "var(--muted)" }
              }
            >
              {op.label}
            </button>
          ))}
        </div>
      }
      pontos={pontos}
      mensagemVazia="Nenhum dado importado ainda."
    />
  );
}
