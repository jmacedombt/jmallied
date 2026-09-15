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
  const [naFila, setNaFila] = useState(0);
  const [historico, setHistorico] = useState<LinhaHistorico[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Fila de códigos bipados. O leitor físico manda o Enter sozinho logo
  // depois de cada código, bem mais rápido do que o ciclo completo de uma
  // bipagem (localizar -> imprimir -> confirmar, tudo indo e voltando do
  // servidor). Antes, uma bipagem que chegasse enquanto a anterior ainda
  // estava em andamento era simplesmente descartada (e o campo ainda
  // ficava desabilitado nesse intervalo, então nem dava pra digitar) —
  // era isso que fazia bipar em sequência rápida "perder" aparelhos no
  // meio do caminho. Agora cada bipagem entra numa fila e todas são
  // processadas uma atrás da outra, na ordem, sem perder nenhuma — e o
  // campo nunca fica desabilitado, então dá pra continuar bipando sem
  // parar.
  const filaRef = useRef<string[]>([]);
  const processandoRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function registrar(ok: boolean, mensagem: string) {
    setHistorico((atual) => [
      { id: proximoIdHistorico++, hora: formatarHoraBrasilia(new Date()), ok, mensagem },
      ...atual,
    ]);
  }

  async function processarFila() {
    if (processandoRef.current) return;
    processandoRef.current = true;
    setProcessando(true);
    while (filaRef.current.length > 0) {
      const valor = filaRef.current.shift()!;
      setNaFila(filaRef.current.length);
      try {
        const resultado = await processarBipagem(valor, modo);
        registrar(resultado.ok, resultado.mensagem);
        if (resultado.ok && modo === "triagem") {
          router.refresh();
        }
      } catch {
        registrar(false, "Erro inesperado — confira sua conexão e tente novamente.");
      }
    }
    processandoRef.current = false;
    setProcessando(false);
    inputRef.current?.focus();
  }

  function aoBipar(e?: React.FormEvent) {
    e?.preventDefault();
    const valor = codigo.trim();
    setCodigo("");
    if (!valor) return;
    filaRef.current.push(valor);
    setNaFila(filaRef.current.length);
    processarFila();
  }

  return (
    <div>
      <form onSubmit={aoBipar} className="mb-5">
        <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>
          Bipe o código Trade Allied — pode ir bipando um atrás do outro, sem esperar terminar o anterior
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
            className="w-full rounded-lg border pl-11 pr-4 py-3.5 text-lg text-center outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          />
          {processando && (
            <Loader2 size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--accent2)" }} />
          )}
        </div>
        {naFila > 0 && (
          <p className="text-[11px] mt-1.5" style={{ color: "var(--accent2)" }}>
            {naFila} bipagem(ns) na fila, processando...
          </p>
        )}
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
