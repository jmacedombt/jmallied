"use client";

import { useState } from "react";
import { Eye, Loader2, Printer, Tag, X } from "lucide-react";
import { imprimirCaixaViaAgente, ErroImpressaoAgente } from "@/lib/etiquetas";

/**
 * Prévia visual da etiqueta de caixa (60x40mm) — reproduz em HTML/CSS o
 * mesmo layout do ZPL gerado pelo Allied Print Agent (ver
 * AlliedPrintAgent/etiqueta.py, gerar_zpl_caixa): LOTE/VOLUME em cima,
 * NF DE RETORNO grande e em negrito, OBSERVAÇÃO em destaque (fundo
 * preto) e NF DE ENTRADA + data/hora embaixo. Não é pixel-perfect com o
 * que sai na Zebra (fonte/proporções da impressora térmica são outras),
 * mas deixa o operador conferir os dados antes de gastar etiqueta.
 */
function PreviewEtiquetaCaixa({
  lote,
  volumeAtual,
  volumeTotal,
  nfRetorno,
  observacao,
  nfEntrada,
}: {
  lote: string;
  volumeAtual: string;
  volumeTotal: string;
  nfRetorno: string;
  observacao: "APROVADO" | "REPROVADO";
  nfEntrada: string;
}) {
  const dataHora = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="w-full rounded-md overflow-hidden select-none"
      style={{ aspectRatio: "3 / 2", background: "#fff", color: "#000", border: "2px solid #000" }}
    >
      <div className="flex items-start justify-between px-2.5 pt-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-wide leading-none">LOTE</p>
          <p className="text-xl font-black leading-none mt-1 truncate">{lote || "—"}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-bold tracking-wide leading-none">VOLUME</p>
          <p className="text-3xl font-black leading-none mt-1 truncate">
            {volumeAtual || "—"}/{volumeTotal || "—"}
          </p>
        </div>
      </div>

      <div className="mt-2" style={{ borderTop: "2px solid #000" }} />

      <div className="text-center px-2 pt-1.5">
        <p className="text-[9px] font-bold tracking-wide leading-none">NF DE RETORNO</p>
        <p className="text-2xl font-black leading-none mt-1 truncate">{nfRetorno || "—"}</p>
      </div>

      <div className="mt-1.5" style={{ borderTop: "2px solid #000" }} />

      <div className="text-center py-2" style={{ background: "#000", color: "#fff" }}>
        <p className="text-base font-black leading-none tracking-wide">{observacao}</p>
      </div>

      <div style={{ borderTop: "2px solid #000" }} />

      <div className="flex items-start justify-between px-2.5 pt-1.5">
        <div className="min-w-0">
          <p className="text-[8px] font-bold tracking-wide leading-none">NF DE ENTRADA</p>
          <p className="text-sm font-black leading-none mt-1 truncate">{nfEntrada || "—"}</p>
        </div>
        <p className="text-[8px] leading-none mt-0.5 shrink-0">{dataHora}</p>
      </div>
    </div>
  );
}

/**
 * Pop-up "Etiqueta Avulsa" (Ag. Emissão de Nota Fiscal) — imprime UMA
 * etiqueta de caixa com todos os campos em aberto pra preenchimento
 * manual (pedido explícito: "para imprimir etiquetas avulsas deixando
 * os campos em aberto para preenchimento"). Usa o mesmo layout/rota do
 * botão "Etiqueta de Caixa" de cada linha (ver
 * imprimirCaixaViaAgente em lib/etiquetas.ts), só que aqui quem digita
 * os valores é o operador, não o sistema.
 *
 * Fluxo em 2 passos (pedido explícito: "antes de imprimir gere um
 * preview na tela"): primeiro clique só mostra a prévia (PreviewEtiquetaCaixa,
 * abaixo dos campos); o mesmo botão vira "Confirmar e Imprimir" — e só
 * aí manda pro Allied Print Agent. Qualquer edição depois de gerar a
 * prévia esconde ela de novo, pra nunca confirmar uma prévia
 * desatualizada.
 */
export default function PopupEtiquetaCaixaAvulsa({ onFechar }: { onFechar: () => void }) {
  const [lote, setLote] = useState("1");
  const [volumeAtual, setVolumeAtual] = useState("1");
  const [volumeTotal, setVolumeTotal] = useState("1");
  const [nfRetorno, setNfRetorno] = useState("");
  const [observacao, setObservacao] = useState<"APROVADO" | "REPROVADO">("APROVADO");
  const [nfEntrada, setNfEntrada] = useState("");
  const [previewGerado, setPreviewGerado] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  /** Qualquer alteração de campo depois da prévia gerada invalida ela —
   * o operador precisa visualizar de novo antes de confirmar. */
  function editar<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setPreviewGerado(false);
      setSucesso(false);
      setter(valor);
    };
  }

  async function imprimir() {
    setErro(null);
    setSucesso(false);
    setImprimindo(true);
    try {
      await imprimirCaixaViaAgente({
        lote: lote.trim() || "—",
        volumeAtual: volumeAtual.trim() || "—",
        volumeTotal: volumeTotal.trim() || "—",
        nfRetorno: nfRetorno.trim(),
        observacao,
        nfEntrada: nfEntrada.trim(),
      });
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ErroImpressaoAgente ? e.message : "Não foi possível imprimir essa etiqueta.");
    }
    setImprimindo(false);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !imprimindo && onFechar()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Tag size={18} style={{ color: "var(--accent2)" }} />
            Etiqueta Avulsa
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={imprimindo}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Preencha os campos, visualize a prévia e confirme a impressão (mesma etiqueta 60x40mm da Zebra) sem
          vincular a nenhum lote do sistema.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Lote
            </label>
            <input
              value={lote}
              onChange={(e) => editar(setLote)(e.target.value)}
              disabled={imprimindo}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
              style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Volume (atual / total)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                value={volumeAtual}
                onChange={(e) => editar(setVolumeAtual)(e.target.value)}
                disabled={imprimindo}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
              <span style={{ color: "var(--muted)" }}>/</span>
              <input
                value={volumeTotal}
                onChange={(e) => editar(setVolumeTotal)(e.target.value)}
                disabled={imprimindo}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>
          </div>
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          NF de Retorno
        </label>
        <input
          value={nfRetorno}
          onChange={(e) => editar(setNfRetorno)(e.target.value)}
          disabled={imprimindo}
          placeholder="Ex.: 123456"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-3"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Observação
        </label>
        <div className="flex items-center gap-2 mb-3">
          {(["APROVADO", "REPROVADO"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => editar(setObservacao)(opcao)}
              disabled={imprimindo}
              className="flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:opacity-60"
              style={{
                borderColor: observacao === opcao ? "var(--accent2)" : "var(--line)",
                color: observacao === opcao ? "var(--accent2)" : "var(--ink)",
                background: observacao === opcao ? "rgba(59,130,246,0.08)" : "var(--surface2)",
              }}
            >
              {opcao}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          NF de Entrada (NF Remessa)
        </label>
        <input
          value={nfEntrada}
          onChange={(e) => editar(setNfEntrada)(e.target.value)}
          disabled={imprimindo}
          placeholder="Ex.: 654321"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-1"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />

        {previewGerado && (
          <div className="mt-4 mb-1">
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Prévia da etiqueta
            </p>
            <PreviewEtiquetaCaixa
              lote={lote}
              volumeAtual={volumeAtual}
              volumeTotal={volumeTotal}
              nfRetorno={nfRetorno}
              observacao={observacao}
              nfEntrada={nfEntrada}
            />
          </div>
        )}

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-1 mt-3">
            {erro}
          </p>
        )}

        {sucesso && !erro && (
          <p
            className="text-sm rounded-lg px-3 py-2 mb-1 mt-3"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e" }}
          >
            Etiqueta enviada pra impressão.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onFechar}
            disabled={imprimindo}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => (previewGerado ? imprimir() : setPreviewGerado(true))}
            disabled={imprimindo}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "var(--accent2)" }}
          >
            {imprimindo ? (
              <Loader2 size={15} className="animate-spin" />
            ) : previewGerado ? (
              <Printer size={15} />
            ) : (
              <Eye size={15} />
            )}
            {imprimindo ? "Imprimindo..." : previewGerado ? "Confirmar e Imprimir" : "Visualizar Etiqueta"}
          </button>
        </div>
      </div>
    </div>
  );
}
