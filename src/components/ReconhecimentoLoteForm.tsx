"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2 } from "lucide-react";

export type LoteReconhecimento = {
  id: string;
  nf_remessa_allied: string;
  importado_em: string;
  aparelhos_no_arquivo: number;
  data_reconhecimento: string | null;
};

export default function ReconhecimentoLoteForm({ lotes }: { lotes: LoteReconhecimento[] }) {
  const router = useRouter();

  const [loteId, setLoteId] = useState("");
  const [data, setData] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const loteSelecionado = lotes.find((l) => l.id === loteId) ?? null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!loteId || !data) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const res = await fetch(`/api/operacional/lotes/${loteId}/reconhecimento`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_reconhecimento: data }),
      });
      const resposta = await res.json();

      if (!res.ok) {
        setErro(resposta.error || "Não foi possível salvar.");
      } else {
        setSucesso(
          `Data Reconhecimento gravada para o lote ${resposta.lote.nf_remessa_allied} — ${resposta.aparelhos_atualizados} aparelho(s) atualizado(s).`
        );
        setLoteId("");
        setData("");
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }

    setSalvando(false);
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <form onSubmit={salvar} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 min-w-[260px]">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Lote (NF Remessa)
          </label>
          <select
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          >
            <option value="">Selecione um lote já importado…</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nf_remessa_allied} — {new Date(lote.importado_em).toLocaleDateString("pt-BR")} —{" "}
                {lote.aparelhos_no_arquivo} aparelho(s)
                {lote.data_reconhecimento ? " (já reconhecido)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Data Reconhecimento
          </label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          />
        </div>

        <button
          type="submit"
          disabled={salvando || !loteId || !data}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 transition"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          <CalendarCheck2 size={16} />
          {salvando ? "Salvando..." : "Salvar reconhecimento"}
        </button>
      </form>

      {loteSelecionado?.data_reconhecimento && (
        <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
          Esse lote já tem Data Reconhecimento gravada (
          {new Date(loteSelecionado.data_reconhecimento + "T00:00:00").toLocaleDateString("pt-BR")}). Salvar de novo
          substitui a data em todos os aparelhos do lote.
        </p>
      )}

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>
      )}

      {sucesso && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mt-4">
          {sucesso}
        </p>
      )}
    </div>
  );
}
