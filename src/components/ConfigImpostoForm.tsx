"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfigImpostoForm({ icmsInicial }: { icmsInicial: number }) {
  const router = useRouter();

  const [icms, setIcms] = useState(String(icmsInicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const res = await fetch("/api/configuracoes/impostos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icms_percentual: icms.replace(",", ".") }),
    });
    const data = await res.json();
    setSalvando(false);

    if (!res.ok) {
      setErro(data.error || "Não foi possível salvar.");
      return;
    }

    setSalvo(true);
    router.refresh();
    setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-5 max-w-md space-y-4"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Percentual de ICMS usado no cálculo de lucro do BID (a fórmula completa de lucro entra numa próxima etapa).
      </p>

      <div className="space-y-1.5">
        <label htmlFor="icms" className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          ICMS
        </label>
        <div className="relative">
          <input
            id="icms"
            inputMode="decimal"
            value={icms}
            onChange={(e) => setIcms(e.target.value)}
            className="w-full rounded-lg border pl-4 pr-9 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>
            %
          </span>
        </div>
      </div>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{erro}</p>
      )}
      {salvo && <p className="text-sm text-emerald-400">Valor salvo!</p>}

      <button
        type="submit"
        disabled={salvando}
        className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
        style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
