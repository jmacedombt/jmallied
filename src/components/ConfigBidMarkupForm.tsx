"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";

export type FaixaMarkupLinha = {
  id: string;
  valor_min: number;
  valor_max: number | null;
  multiplicador: number;
  ordem: number;
};

function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ConfigBidMarkupForm({ faixasIniciais }: { faixasIniciais: FaixaMarkupLinha[] }) {
  const router = useRouter();

  const [faixas, setFaixas] = useState(faixasIniciais);
  const [valores, setValores] = useState<Record<string, { valor_min: string; valor_max: string; multiplicador: string }>>(
    () =>
      Object.fromEntries(
        faixasIniciais.map((f) => [
          f.id,
          {
            valor_min: String(f.valor_min),
            valor_max: f.valor_max == null ? "" : String(f.valor_max),
            multiplicador: String(f.multiplicador),
          },
        ])
      )
  );
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizarCampo(id: string, campo: "valor_min" | "valor_max" | "multiplicador", valor: string) {
    setValores((v) => ({ ...v, [id]: { ...v[id], [campo]: valor } }));
  }

  async function salvarLinha(id: string) {
    setSalvandoId(id);
    setErro(null);
    const v = valores[id];
    try {
      const res = await fetch(`/api/configuracoes/bid-markup/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_min: v.valor_min.replace(",", "."),
          valor_max: v.valor_max.trim() === "" ? null : v.valor_max.replace(",", "."),
          multiplicador: v.multiplicador.replace(",", "."),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível salvar essa faixa.");
      } else {
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setSalvandoId(null);
  }

  async function excluirLinha(id: string) {
    setExcluindoId(id);
    setErro(null);
    try {
      const res = await fetch(`/api/configuracoes/bid-markup/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível excluir essa faixa.");
      } else {
        setFaixas((f) => f.filter((faixa) => faixa.id !== id));
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setExcluindoId(null);
  }

  async function adicionarLinha() {
    setCriando(true);
    setErro(null);
    try {
      const res = await fetch("/api/configuracoes/bid-markup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor_min: 0, valor_max: null, multiplicador: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível criar a faixa.");
      } else {
        setFaixas((f) => [...f, data]);
        setValores((v) => ({
          ...v,
          [data.id]: {
            valor_min: String(data.valor_min),
            valor_max: data.valor_max == null ? "" : String(data.valor_max),
            multiplicador: String(data.multiplicador),
          },
        }));
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setCriando(false);
  }

  return (
    <div className="rounded-xl border overflow-hidden max-w-3xl" style={{ borderColor: "var(--line)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
            <th className="px-4 py-2.5 font-medium">De (R$)</th>
            <th className="px-4 py-2.5 font-medium">Até (R$) — vazio = acima de</th>
            <th className="px-4 py-2.5 font-medium">Multiplicador</th>
            <th className="px-4 py-2.5 font-medium w-24"></th>
          </tr>
        </thead>
        <tbody>
          {faixas
            .slice()
            .sort((a, b) => a.ordem - b.ordem)
            .map((faixa) => {
              const v = valores[faixa.id];
              return (
                <tr key={faixa.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-4 py-2.5">
                    <input
                      value={v.valor_min}
                      onChange={(e) => atualizarCampo(faixa.id, "valor_min", e.target.value)}
                      inputMode="decimal"
                      className="w-24 rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)]"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      value={v.valor_max}
                      onChange={(e) => atualizarCampo(faixa.id, "valor_max", e.target.value)}
                      inputMode="decimal"
                      placeholder="acima de"
                      className="w-28 rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)]"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <span style={{ color: "var(--muted)" }}>×</span>
                      <input
                        value={v.multiplicador}
                        onChange={(e) => atualizarCampo(faixa.id, "multiplicador", e.target.value)}
                        inputMode="decimal"
                        className="w-20 rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)]"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Salvar"
                        disabled={salvandoId === faixa.id}
                        onClick={() => salvarLinha(faixa.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10 shrink-0 disabled:opacity-50"
                        style={{ color: "var(--accent2)" }}
                      >
                        <Save size={14} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        disabled={excluindoId === faixa.id}
                        onClick={() => excluirLinha(faixa.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10 shrink-0 disabled:opacity-50 text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <div className="p-4 border-t" style={{ borderColor: "var(--line)" }}>
        <button
          type="button"
          onClick={adicionarLinha}
          disabled={criando}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition hover:border-[var(--accent2)] disabled:opacity-50"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <Plus size={15} />
          {criando ? "Adicionando..." : "Adicionar faixa"}
        </button>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">{erro}</p>
        )}

        <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
          Exemplo de leitura: custo entre R$ {formatarReais(0)} e R$ {formatarReais(10)} → Custo Peça (Allied) = custo ×
          4, arredondado pra cima com 2 casas decimais.
        </p>
      </div>
    </div>
  );
}
