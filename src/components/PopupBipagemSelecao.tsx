"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, ScanBarcode, X, XCircle } from "lucide-react";

export type ItemBipagemSelecao = { id: string; os_reparadora: string | null; trade_allied: string };

type LinhaHistorico = { id: number; ok: boolean; mensagem: string };

let proximoIdHistorico = 1;

/**
 * Pop-up de "Bipar / Selecionar" de "7 - Reparo Finalizado" e
 * "8 - Orçamento Reprovado" — um campo de texto com foco automático
 * (mesmo padrão de PainelBipagem.tsx, pensado pro leitor físico de
 * código de barras: digita/bipa e aperta Enter sozinho) que aceita
 * tanto o código da OS Reparadora quanto o do Trade Allied — descobre
 * sozinho qual dos dois bateu e marca a linha correspondente como
 * selecionada (fica com fundo/borda verde na tabela por trás, ver
 * PainelOrcamentoReprovado.tsx). Seleção manual pelo checkbox da
 * tabela conta junto — o pop-up só soma nesse mesmo conjunto
 * compartilhado, nunca substitui.
 */
export default function PopupBipagemSelecao({
  itens,
  selecionados,
  onSelecionar,
  onEmitir,
  emitindo,
  erroEmitir,
  rotuloEmitir,
  onFechar,
}: {
  itens: ItemBipagemSelecao[];
  selecionados: Set<string>;
  onSelecionar: (id: string) => void;
  onEmitir: () => void;
  emitindo: boolean;
  erroEmitir: string | null;
  rotuloEmitir: string;
  onFechar: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [historico, setHistorico] = useState<LinhaHistorico[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function registrar(ok: boolean, mensagem: string) {
    setHistorico((atual) => [{ id: proximoIdHistorico++, ok, mensagem }, ...atual].slice(0, 30));
  }

  function aoBipar(e?: React.FormEvent) {
    e?.preventDefault();
    const valor = codigo.trim();
    setCodigo("");
    if (!valor) return;

    const encontrado = itens.find(
      (i) => (i.os_reparadora ?? "").trim() === valor || i.trade_allied.trim().toLowerCase() === valor.toLowerCase()
    );

    if (!encontrado) {
      registrar(false, `"${valor}" não encontrado nessa lista.`);
      return;
    }

    const jaEstava = selecionados.has(encontrado.id);
    onSelecionar(encontrado.id);
    registrar(true, jaEstava ? `${encontrado.trade_allied} já estava selecionado.` : `${encontrado.trade_allied} selecionado.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <ScanBarcode size={18} style={{ color: "var(--accent2)" }} />
            Bipar / Selecionar
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={aoBipar} className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>
            Bipe ou digite o Trade Allied ou a OS Reparadora e aperte Enter
          </label>
          <div className="relative">
            <ScanBarcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              ref={inputRef}
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Trade Allied ou OS Reparadora..."
              autoFocus
              className="w-full rounded-lg border pl-11 pr-4 py-3 text-base text-center outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition"
              style={{ color: "var(--ink)", background: "var(--surface2)", borderColor: "var(--line)" }}
            />
          </div>
        </form>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Histórico desta sessão
          </p>
          <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>
            {selecionados.size} selecionado(s)
          </p>
        </div>
        <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {historico.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                Nada bipado ainda.
              </p>
            ) : (
              <ul>
                {historico.map((linha) => (
                  <li
                    key={linha.id}
                    className="flex items-start gap-2 px-3 py-2 border-t text-xs"
                    style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  >
                    {linha.ok ? (
                      <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
                    ) : (
                      <XCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                    )}
                    <span style={{ color: "var(--ink)" }}>{linha.mensagem}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {erroEmitir && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{erroEmitir}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={emitindo}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={onEmitir}
            disabled={emitindo || selecionados.size === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {emitindo ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {rotuloEmitir} ({selecionados.size})
          </button>
        </div>
      </div>
    </div>
  );
}
