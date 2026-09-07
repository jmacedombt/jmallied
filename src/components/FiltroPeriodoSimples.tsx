"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";

// Filtro de período sem granularidade (dia/semana/mês) — usado em telas
// de métricas que não são série temporal, e sim um resumo/ranking do
// período inteiro (ex: Métricas > Orçamentos). Mesmo padrão de
// querystring do FiltroPeriodoMetricas (inicio/fim), só sem os botões de
// granularidade, que não fazem sentido aqui.
export default function FiltroPeriodoSimples({ inicio, fim }: { inicio: string; fim: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rascunhoInicio, setRascunhoInicio] = useState(inicio);
  const [rascunhoFim, setRascunhoFim] = useState(fim);

  function aplicar() {
    if (!rascunhoInicio || !rascunhoFim) return;
    const novo = new URLSearchParams(searchParams.toString());
    novo.set("inicio", rascunhoInicio);
    novo.set("fim", rascunhoFim);
    router.push(`${pathname}?${novo.toString()}`);
  }

  const estiloInput: React.CSSProperties = {
    borderColor: "var(--line)",
    background: "var(--surface2)",
    color: "var(--ink)",
  };

  return (
    <div className="flex items-center flex-wrap gap-2 mb-5">
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
        <CalendarRange size={13} />
        Período (data de fechamento do orçamento):
      </span>
      <input
        type="date"
        value={rascunhoInicio}
        max={rascunhoFim}
        onChange={(e) => setRascunhoInicio(e.target.value)}
        className="rounded-lg border px-2.5 py-1.5 text-xs outline-none"
        style={estiloInput}
      />
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        até
      </span>
      <input
        type="date"
        value={rascunhoFim}
        min={rascunhoInicio}
        onChange={(e) => setRascunhoFim(e.target.value)}
        className="rounded-lg border px-2.5 py-1.5 text-xs outline-none"
        style={estiloInput}
      />
      <button
        type="button"
        onClick={aplicar}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
        style={{ background: "var(--accent)" }}
      >
        Aplicar
      </button>
    </div>
  );
}
