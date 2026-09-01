"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfigMaoDeObraForm({
  valorSemPecaInicial,
  valorUmaPecaInicial,
  valorMaisDeUmaPecaInicial,
}: {
  valorSemPecaInicial: number;
  valorUmaPecaInicial: number;
  valorMaisDeUmaPecaInicial: number;
}) {
  const router = useRouter();

  const [valorSemPeca, setValorSemPeca] = useState(String(valorSemPecaInicial));
  const [valorUmaPeca, setValorUmaPeca] = useState(String(valorUmaPecaInicial));
  const [valorMaisDeUmaPeca, setValorMaisDeUmaPeca] = useState(String(valorMaisDeUmaPecaInicial));

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const res = await fetch("/api/configuracoes/mao-de-obra", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valor_sem_peca: valorSemPeca.replace(",", "."),
        valor_uma_peca: valorUmaPeca.replace(",", "."),
        valor_mais_de_uma_peca: valorMaisDeUmaPeca.replace(",", "."),
      }),
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
      className="rounded-xl border p-5 max-w-lg space-y-4"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Esses valores definem como o sistema calcula automaticamente a coluna{" "}
        <strong>Mão de obra</strong> de cada orçamento, com base em quantas peças
        (das 10 do orçamento inicial + as 5 adicionais) foram usadas no reparo.
      </p>

      <Campo label="Sem nenhuma peça usada" htmlFor="valor_sem_peca">
        <ValorInput id="valor_sem_peca" value={valorSemPeca} onChange={setValorSemPeca} />
      </Campo>

      <Campo label="Com exatamente 1 peça usada" htmlFor="valor_uma_peca">
        <ValorInput id="valor_uma_peca" value={valorUmaPeca} onChange={setValorUmaPeca} />
      </Campo>

      <Campo label="Com mais de 1 peça usada" htmlFor="valor_mais_de_uma_peca">
        <ValorInput id="valor_mais_de_uma_peca" value={valorMaisDeUmaPeca} onChange={setValorMaisDeUmaPeca} />
      </Campo>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{erro}</p>
      )}
      {salvo && <p className="text-sm text-emerald-400">Valores salvos!</p>}

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

function ValorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>
        R$
      </span>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)]"
      />
    </div>
  );
}

function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
