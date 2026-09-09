"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { PALAVRA_CONFIRMACAO_ZERAR } from "@/lib/manutencao";

// Trava forte pro botão "Zerar" de cada grupo em Sistema > Manutenção do
// Banco — só libera o clique depois de digitar a palavra de confirmação
// certinha (não é um "tem certeza? sim/não" que dá pra clicar sem
// prestar atenção). Visual em vermelho o tempo todo, sem modo "não
// perigoso" — essa tela só existe pra ação destrutiva.
export default function PopupConfirmarZerar({
  titulo,
  tabelas,
  carregando,
  erro,
  onConfirmar,
  onFechar,
}: {
  titulo: string;
  tabelas: string[];
  carregando: boolean;
  erro: string | null;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const liberado = texto.trim() === PALAVRA_CONFIRMACAO_ZERAR;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "#dc2626" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "#ef4444" }}>
            <AlertTriangle size={18} />
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Isso apaga <strong style={{ color: "var(--ink)" }}>permanentemente</strong> e{" "}
          <strong style={{ color: "var(--ink)" }}>sem volta</strong> todos os registros das tabelas abaixo. Não afeta
          usuários nem nenhuma configuração do sistema.
        </p>

        <ul className="text-xs font-mono mb-4 rounded-lg border p-3 space-y-0.5" style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--muted)" }}>
          {tabelas.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
          Digite <strong style={{ color: "#ef4444" }}>{PALAVRA_CONFIRMACAO_ZERAR}</strong> pra confirmar
        </label>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={PALAVRA_CONFIRMACAO_ZERAR}
          autoFocus
          disabled={carregando}
          className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono outline-none focus:border-[#ef4444] transition mb-4"
          style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
        />

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{erro}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!liberado || carregando}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#dc2626" }}
          >
            {carregando && <Loader2 size={14} className="animate-spin" />}
            Apagar tudo
          </button>
        </div>
      </div>
    </div>
  );
}
