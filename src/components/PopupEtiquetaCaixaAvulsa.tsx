"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, Printer, Tag, X } from "lucide-react";
import { imprimirCaixaViaAgente, ErroImpressaoAgente } from "@/lib/etiquetas";
import PreviewEtiquetaCaixa from "@/components/PreviewEtiquetaCaixa";

type NfRetornoEmitida = {
  numero: string;
  remessas: { nf: string; quantidade: number }[];
  aparelhos: number;
  aprovados: number;
  reprovados: number;
};

/**
 * Etiqueta Avulsa NF Retorno — etiqueta de caixa (60x40mm, Zebra) com
 * preenchimento manual. Desde 23/11/2026 (pedido explícito) a NF de
 * Retorno só pode ser uma NF JÁ EMITIDA no sistema, escolhida numa lista
 * suspensa (api/impressao/nfs-retorno); ao escolher, a NF de Entrada
 * (NF Remessa) e a Observação (Aprovado/Reprovado) vêm preenchidas.
 *
 * Usado em 2 lugares: pop-up em Ag. Emissão de Nota Fiscal (botão
 * "Etiqueta Avulsa") e a tela Impressão > Impressão Avulsa NF Retorno.
 *
 * Fluxo em 2 passos: "Visualizar Etiqueta" mostra a prévia; o botão vira
 * "Confirmar e Imprimir". Qualquer edição esconde a prévia de novo.
 */
export function FormEtiquetaNfRetorno({ onFechar }: { onFechar?: () => void }) {
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

  const [nfs, setNfs] = useState<NfRetornoEmitida[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/impressao/nfs-retorno", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (cancelado) return;
        if (!r.ok) throw new Error(d?.error || "Não foi possível carregar as NFs de Retorno.");
        setNfs(d.nfs ?? []);
      })
      .catch((e) => !cancelado && setErroLista(e instanceof Error ? e.message : "Falha de conexão."));
    return () => {
      cancelado = true;
    };
  }, []);

  const selecionada = nfs?.find((n) => n.numero === nfRetorno) ?? null;

  function editar<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setPreviewGerado(false);
      setSucesso(false);
      setter(valor);
    };
  }

  function escolherNfRetorno(numero: string) {
    setPreviewGerado(false);
    setSucesso(false);
    setNfRetorno(numero);
    const nf = nfs?.find((n) => n.numero === numero);
    if (!nf) {
      setNfEntrada("");
      return;
    }
    // NF de Entrada: a remessa com mais aparelhos nessa NF de Retorno
    const principal = [...nf.remessas].sort((a, b) => b.quantidade - a.quantidade)[0];
    setNfEntrada(principal?.nf ?? "");
    if (nf.aprovados > 0 && nf.reprovados === 0) setObservacao("APROVADO");
    else if (nf.reprovados > 0 && nf.aprovados === 0) setObservacao("REPROVADO");
  }

  async function imprimir() {
    if (!selecionada) return;
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

  const estiloCampo: React.CSSProperties = { background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" };

  return (
    <div>
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
            style={estiloCampo}
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
              className="w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm outline-none transition"
              style={estiloCampo}
            />
            <span style={{ color: "var(--muted)" }}>/</span>
            <input
              value={volumeTotal}
              onChange={(e) => editar(setVolumeTotal)(e.target.value)}
              disabled={imprimindo}
              className="w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm outline-none transition"
              style={estiloCampo}
            />
          </div>
        </div>
      </div>

      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
        NF de Retorno <span style={{ color: "#dc2626" }}>*</span> <span className="font-normal">(só NFs já emitidas)</span>
      </label>
      {erroLista ? (
        <p className="text-xs text-red-500 mb-3">{erroLista}</p>
      ) : nfs == null ? (
        <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Loader2 size={13} className="animate-spin" /> Carregando NFs de Retorno emitidas…
        </p>
      ) : nfs.length === 0 ? (
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Nenhuma NF de Retorno emitida ainda.
        </p>
      ) : (
        <select
          value={nfRetorno}
          onChange={(e) => escolherNfRetorno(e.target.value)}
          disabled={imprimindo}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-1"
          style={estiloCampo}
        >
          <option value="">Selecione a NF de Retorno…</option>
          {nfs.map((n) => (
            <option key={n.numero} value={n.numero}>
              {n.numero} — NF Remessa {n.remessas.map((r) => r.nf).join(", ")} · {n.aparelhos} aparelho(s)
            </option>
          ))}
        </select>
      )}
      {selecionada && (
        <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
          {selecionada.aprovados} aprovado(s) · {selecionada.reprovados} reprovado(s)
        </p>
      )}
      {!selecionada && <div className="mb-2" />}

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
      {selecionada && selecionada.remessas.length > 1 ? (
        <select
          value={nfEntrada}
          onChange={(e) => editar(setNfEntrada)(e.target.value)}
          disabled={imprimindo}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-1"
          style={estiloCampo}
        >
          {selecionada.remessas.map((r) => (
            <option key={r.nf} value={r.nf}>
              {r.nf} ({r.quantidade} aparelho(s))
            </option>
          ))}
        </select>
      ) : (
        <input
          value={nfEntrada}
          readOnly
          placeholder="Preenchida ao escolher a NF de Retorno"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-1"
          style={{ ...estiloCampo, opacity: 0.85 }}
        />
      )}

      {previewGerado && selecionada && (
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
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-1 mt-3">{erro}</p>
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
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            disabled={imprimindo}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
        )}
        <button
          type="button"
          onClick={() => (previewGerado ? imprimir() : setPreviewGerado(true))}
          disabled={imprimindo || !selecionada}
          title={!selecionada ? "Escolha uma NF de Retorno emitida" : undefined}
          className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-50"
          style={{ background: "var(--accent2)" }}
        >
          {imprimindo ? <Loader2 size={15} className="animate-spin" /> : previewGerado ? <Printer size={15} /> : <Eye size={15} />}
          {imprimindo ? "Imprimindo..." : previewGerado ? "Confirmar e Imprimir" : "Visualizar Etiqueta"}
        </button>
      </div>
    </div>
  );
}

export default function PopupEtiquetaCaixaAvulsa({ onFechar }: { onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Tag size={18} style={{ color: "var(--accent2)" }} />
            Etiqueta Avulsa NF Retorno
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
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Escolha uma NF de Retorno já emitida, confira os campos, visualize a prévia e confirme a impressão (etiqueta
          60x40mm da Zebra).
        </p>
        <FormEtiquetaNfRetorno onFechar={onFechar} />
      </div>
    </div>
  );
}
