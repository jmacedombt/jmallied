"use client";

import { useState } from "react";
import { Info, Loader2, ShieldPlus, X } from "lucide-react";

/**
 * Cadastra um cargo no registro de referência (SISTEMA > Cargos). Deixa
 * bem claro, antes de salvar, que isso é só um REGISTRO — nome +
 * descrição do que foi pedido — e não cria nenhuma permissão de fato:
 * pra um cargo novo ganhar acesso de verdade a um módulo, alguém ainda
 * precisa implementar isso em código (do jeito que ALLIED, Operacional e
 * Triagem/OQC foram feitos nesse sistema).
 */
export default function PopupNovoCargoCustomizado({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome do cargo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/sistema/cargos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, descricao }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível cadastrar esse cargo.");
        setEnviando(false);
        return;
      }
      onCriado();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <ShieldPlus size={18} style={{ color: "var(--accent2)" }} />
            Novo cargo
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2.5 mb-4 text-xs"
          style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--muted)" }}
        >
          <Info size={14} className="shrink-0 mt-0.5" style={{ color: "var(--accent2)" }} />
          <span>
            Isso cadastra só o <strong style={{ color: "var(--ink)" }}>registro</strong> do cargo — nome e o que ele
            deve acessar. Não libera nenhum módulo sozinho: pra funcionar de verdade, o acesso de cada tela ainda
            precisa ser implementado (é assim que todos os cargos atuais foram feitos).
          </span>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Nome do cargo
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Financeiro"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              O que esse cargo deve acessar (descrição)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: só a tela de Métricas > Orçamentos, sem nenhuma ação no Operacional."
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition resize-none"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 transition"
            style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Cadastrar
          </button>
        </div>
      </div>
    </div>
  );
}
