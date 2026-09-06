"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { OPCOES_GRANULARIDADE, type Granularidade } from "@/lib/metricas";

// Filtro compartilhado por Volumetria e R-TAT: granularidade
// (Dia/Semana/Mês) e, opcionalmente, um período customizado — sempre
// via querystring, pra a própria página de servidor buscar de novo com
// o intervalo certo (nada de refazer o fetch na mão aqui).
export default function FiltroPeriodoMetricas({
  granularidade,
  inicio,
  fim,
}: {
  granularidade: Granularidade;
  inicio: string;
  fim: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [personalizado, setPersonalizado] = useState(() => searchParams.has("inicio") || searchParams.has("fim"));
  const [rascunhoInicio, setRascunhoInicio] = useState(inicio);
  const [rascunhoFim, setRascunhoFim] = useState(fim);

  function aplicar(mudancas: Record<string, string | null>) {
    const novo = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) novo.delete(chave);
      else novo.set(chave, valor);
    }
    router.push(`${pathname}?${novo.toString()}`);
  }

  function trocarGranularidade(g: Granularidade) {
    aplicar({ granularidade: g });
  }

  function aplicarPeriodoPersonalizado() {
    if (!rascunhoInicio || !rascunhoFim) return;
    aplicar({ inicio: rascunhoInicio, fim: rascunhoFim });
  }

  function limparPeriodoPersonalizado() {
    setPersonalizado(false);
    aplicar({ inicio: null, fim: null });
  }

  const estiloInput: React.CSSProperties = {
    borderColor: "var(--line)",
    background: "var(--surface2)",
    color: "var(--ink)",
  };

  return (
    <div className="flex items-center flex-wrap gap-3 mb-5">
      <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        {OPCOES_GRANULARIDADE.map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => trocarGranularidade(op.valor)}
            className="px-3 py-1.5 text-xs font-medium transition"
            style={
              granularidade === op.valor
                ? { background: "var(--surface2)", color: "var(--ink)" }
                : { color: "var(--muted)" }
            }
          >
            {op.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPersonalizado((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface2)]"
        style={{ borderColor: "var(--line)", color: personalizado ? "var(--accent2)" : "var(--muted)" }}
      >
        <CalendarRange size={13} />
        Período personalizado
      </button>

      {personalizado && (
        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={aplicarPeriodoPersonalizado}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
            style={{ background: "var(--accent)" }}
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={limparPeriodoPersonalizado}
            className="text-xs underline decoration-dotted"
            style={{ color: "var(--muted)" }}
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
