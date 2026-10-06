"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Printer, ScanBarcode, X, XCircle } from "lucide-react";
import {
  confirmarImpressao,
  ErroImpressaoAgente,
  imprimirViaAgente,
  localizarParaEtiqueta,
  processarBipagem,
  type OrcamentoParaEtiqueta,
  type TipoBipagem,
} from "@/lib/etiquetas";
import { formatarHoraBrasilia } from "@/lib/tempo";
import PreviewEtiquetaOs from "@/components/PreviewEtiquetaOs";

type LinhaHistorico = {
  id: number;
  hora: string;
  ok: boolean;
  mensagem: string;
};

type ItemParaPreview = {
  logId: string;
  orcamento: OrcamentoParaEtiqueta & { os_reparadora: string };
};

let proximoIdHistorico = 1;

export default function PainelBipagem({ modo }: { modo: TipoBipagem }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [naFila, setNaFila] = useState(0);
  const [historico, setHistorico] = useState<LinhaHistorico[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Pop-up de prévia (só modo "avulsa" — pedido explícito, 06/10/2026:
  // "em impressão avulsa quando imprimir quero o preview na tela"). Ag.
  // Triagem continua imprimindo direto, sem parar pra confirmar — é
  // bipagem rápida em sequência, parar em cada uma quebraria o fluxo.
  const [itemPreview, setItemPreview] = useState<ItemParaPreview | null>(null);
  const [imprimindoPreview, setImprimindoPreview] = useState(false);
  const resolverPreviewRef = useRef<((confirmou: boolean) => void) | null>(null);

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
  // parar. No modo "avulsa", cada item da fila pode parar esperando a
  // confirmação da prévia antes de seguir pro próximo.
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

  /** Mostra a prévia e devolve uma Promise que só resolve quando o
   * operador clicar "Confirmar e Imprimir" (true) ou "Cancelar" (false)
   * — é o que faz `processarFila` esperar antes de seguir pro próximo
   * item da fila. */
  function pedirConfirmacaoPreview(item: ItemParaPreview): Promise<boolean> {
    setItemPreview(item);
    return new Promise<boolean>((resolve) => {
      resolverPreviewRef.current = resolve;
    });
  }

  async function confirmarPreview() {
    setImprimindoPreview(true);
    resolverPreviewRef.current?.(true);
  }

  function cancelarPreview() {
    if (imprimindoPreview) return;
    resolverPreviewRef.current?.(false);
  }

  /** Um ciclo completo da Impressão Avulsa, COM prévia: localizar ->
   * mostra a prévia e espera o operador confirmar -> imprime -> grava o
   * resultado. Se o operador cancelar, só registra o cancelamento (não
   * imprime nada). */
  async function processarUmAvulsa(valor: string) {
    const localizado = await localizarParaEtiqueta(valor, "avulsa");
    if (!localizado.ok) {
      registrar(false, localizado.mensagem);
      return;
    }

    const { logId, orcamento } = localizado;
    const confirmou = await pedirConfirmacaoPreview({ logId, orcamento });
    setItemPreview(null);
    setImprimindoPreview(false);

    if (!confirmou) {
      await confirmarImpressao(logId, false, "Cancelado pelo operador antes de confirmar a impressão.");
      registrar(false, `${orcamento.trade_allied} — impressão cancelada na prévia.`);
      return;
    }

    try {
      await imprimirViaAgente({
        os_reparadora: orcamento.os_reparadora,
        nf_remessa_allied: orcamento.nf_remessa_allied,
        modelo_comercial: orcamento.modelo_comercial,
      });
    } catch (erro) {
      const mensagem = erro instanceof ErroImpressaoAgente ? erro.message : "Erro inesperado ao imprimir.";
      await confirmarImpressao(logId, false, mensagem);
      registrar(false, `OS ${orcamento.os_reparadora} encontrada, mas falhou ao imprimir: ${mensagem}`);
      return;
    }

    await confirmarImpressao(logId, true);
    registrar(
      true,
      `OS ${orcamento.os_reparadora} | NF ${orcamento.nf_remessa_allied} | ${orcamento.modelo_comercial ?? "—"} — etiqueta enviada.`
    );
  }

  async function processarFila() {
    if (processandoRef.current) return;
    processandoRef.current = true;
    setProcessando(true);
    while (filaRef.current.length > 0) {
      const valor = filaRef.current.shift()!;
      setNaFila(filaRef.current.length);
      try {
        if (modo === "avulsa") {
          await processarUmAvulsa(valor);
        } else {
          const resultado = await processarBipagem(valor, modo);
          registrar(resultado.ok, resultado.mensagem);
          if (resultado.ok) {
            router.refresh();
          }
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

      {itemPreview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={cancelarPreview}
        >
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <ScanBarcode size={18} style={{ color: "var(--accent2)" }} />
                Prévia da etiqueta
              </h2>
              <button
                type="button"
                onClick={cancelarPreview}
                disabled={imprimindoPreview}
                aria-label="Cancelar"
                className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Confira os dados antes de confirmar — {itemPreview.orcamento.trade_allied}
            </p>

            <PreviewEtiquetaOs
              osReparadora={itemPreview.orcamento.os_reparadora}
              nfRemessaAllied={itemPreview.orcamento.nf_remessa_allied}
              modeloComercial={itemPreview.orcamento.modelo_comercial}
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={cancelarPreview}
                disabled={imprimindoPreview}
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarPreview}
                disabled={imprimindoPreview}
                className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
                style={{ background: "var(--accent2)" }}
              >
                {imprimindoPreview ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                {imprimindoPreview ? "Imprimindo..." : "Confirmar e Imprimir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
