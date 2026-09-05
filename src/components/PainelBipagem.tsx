"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ScanBarcode, XCircle } from "lucide-react";
import { processarBipagem, type TipoBipagem } from "@/lib/etiquetas";
import { formatarHoraBrasilia } from "@/lib/tempo";

type LinhaHistorico = {
  id: number;
  hora: string;
  ok: boolean;
  mensagem: string;
};

let proximoIdHistorico = 1;

export default function PainelBipagem({ modo }: { modo: TipoBipagem }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [historico, setHistorico] = useState<LinhaHistorico[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function registrar(ok: boolean, mensagem: string) {
    setHistorico((atual) => [
      { id: proximoIdHistorico++, hora: formatarHoraBrasilia(new Date()), ok, mensagem },
      ...atual,
    ]);
  }

  async function aoBipar(e?: React.FormEvent) {
    e?.preventDefault();
    const valor = codigo.trim();
    setCodigo("");
    if (!valor || processando) return;

    setProcessando(true);
    try {
      const resultado = await processarBipagem(valor, modo);
      registrar(resultado.ok, resultado.mensagem);
      if (resultado.ok && modo === "triagem") {
        router.refresh();
      }
    } catch {
      registrar(false, "Erro inesperado — confira sua conexão e tente novamente.");
    } finally {
      setProcessando(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div>
      <form onSubmit={aoBipar} className="mb-5">
        <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>
          Bipe ou digite o código Trade Allied e aperte Enter
        </label>
        <div className="relative">
          <ScanBarcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            ref={inputRef}
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Trade Allied..."
            autoFocus
            disabled={processando}
            className="w-full rounded-lg border pl-11 pr-4 py-3.5 text-lg text-center outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] disabled:opacity-60"
            style={{ color: "var(--ink)" }}
          />
          {processando && (
            <Loader2 size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--accent2)" }} />
          )}
        </div>
      </form>

      <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
        Histórico desta sessão
      </p>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <div className="overflow-y-auto" style={{ maxHeight: "min(420px, calc(100vh - 420px))" }}>
          {historico.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
              Nada bipado ainda nessa sessão.
            </p>
          ) : (
            <ul>
              {historico.map((linha) => (
                <li
                  key={linha.id}
                  className="flex items-start gap-2.5 px-4 py-2.5 border-t text-sm"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                >
                  {linha.ok ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
                  ) : (
                    <XCircle size={16} className="shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                  )}
                  <span style={{ color: "var(--ink)" }}>{linha.mensagem}</span>
                  <span className="ml-auto shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                    {linha.hora}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
