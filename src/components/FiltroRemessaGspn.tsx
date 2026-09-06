"use client";

import { useRouter, usePathname } from "next/navigation";

export type RemessaCasada = { nf_remessa_allied: string; quantidade_chamados: number };

// Filtro de NF Remessa da relação de peças casadas (Base GSPN) — mesmo
// padrão de "muda a URL e deixa o server component re-buscar" já usado
// no menu Métricas (FiltroPeriodoMetricas.tsx), só que com um <select>
// em vez de botões de período.
export default function FiltroRemessaGspn({
  remessas,
  selecionada,
}: {
  remessas: RemessaCasada[];
  selecionada: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function aoMudar(valor: string) {
    if (!valor) {
      router.push(pathname);
    } else {
      router.push(`${pathname}?remessa=${encodeURIComponent(valor)}`);
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
      NF Remessa:
      <select
        value={selecionada ?? ""}
        onChange={(e) => aoMudar(e.target.value)}
        className="rounded-lg border px-2.5 py-1.5 text-xs"
        style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
      >
        <option value="">Todas</option>
        {remessas.map((r) => (
          <option key={r.nf_remessa_allied} value={r.nf_remessa_allied}>
            {r.nf_remessa_allied} ({r.quantidade_chamados})
          </option>
        ))}
      </select>
    </label>
  );
}
