"use client";

import { useState } from "react";
import { Loader2, PackagePlus, Save, X } from "lucide-react";

// Popup de cadastro manual de uma peça que ainda não tem custo na Base
// Peças — aberto a partir do pop-up de peças em Validação de Orçamentos
// quando um código do orçamento não é encontrado em pecas_vigentes.
// Segue o mesmo padrão visual do cadastro manual de peça do BID
// (PopupCadastrarPecaBid), mas grava direto na Base Peças (pecas_compras)
// — o valor passa a valer em qualquer lugar que use esse código, não só
// nesse orçamento.
export default function PopupCadastrarPecaBase({
  codigo,
  onSalvo,
  onFechar,
}: {
  codigo: string;
  onSalvo: (valorUnitario: number) => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const valorNumero = Number(valor.replace(",", "."));
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      setErro("Informe um valor de custo válido.");
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const res = await fetch("/api/bases/pecas/cadastro-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, valor_unitario: valorNumero }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErro(data?.error || "Não foi possível salvar essa peça.");
        setSalvando(false);
        return;
      }

      onSalvo(valorNumero);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackagePlus size={18} style={{ color: "var(--accent2)" }} />
            Cadastrar peça na Base Peças
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
          Esse código ainda não tem custo na Base Peças. O valor informado abaixo passa a valer daí pra frente — em
          qualquer orçamento ou base (BID inclusive) que use esse código.
        </p>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Código da peça
            </label>
            <input
              type="text"
              value={codigo}
              disabled
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono opacity-70"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Custo (valor unitário)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setErro(null);
              }}
              placeholder="0,00"
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
