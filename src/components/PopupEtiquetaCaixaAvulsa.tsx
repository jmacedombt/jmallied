"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, Printer, Tag, X } from "lucide-react";
import { imprimirCaixaViaAgente, ErroImpressaoAgente, type DadosEtiquetaCaixa } from "@/lib/etiquetas";
import PreviewEtiquetaCaixa from "@/components/PreviewEtiquetaCaixa";

type GrupoNf = {
  nfEnvio: string;
  status: "APROVADO" | "REPROVADO";
  tipo: "REPARO" | "REINCIDÊNCIA";
  quantidade: number;
  nfPeca: string;
  nfServico: string;
  reparadora: string;
};

type NfRetornoEmitida = {
  numero: string;
  aparelhos: number;
  remessas: string[];
  grupos: GrupoNf[];
};

/**
 * Etiqueta Avulsa NF Retorno — UMA etiqueta de caixa no padrão da Allied
 * (25/11/2026). A NF de Retorno só pode ser uma NF JÁ EMITIDA (lista
 * suspensa, api/impressao/nfs-retorno); ao escolher a NF e o grupo
 * (NF envio + Aprovado/Reprovado + Reparo/Reincidência), reparadora,
 * tipo, status, NF Peça/Serviço e NF envio vêm preenchidos. O operador
 * informa "Caixa X de Y" e a quantidade daquela caixa.
 *
 * Usado no pop-up de Ag. Emissão de Nota Fiscal ("Etiqueta Avulsa") e na
 * tela Impressão > Impressão Avulsa NF Retorno.
 */
export function FormEtiquetaNfRetorno({ onFechar }: { onFechar?: () => void }) {
  const [nfs, setNfs] = useState<NfRetornoEmitida[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [nfRetorno, setNfRetorno] = useState("");
  const [indiceGrupo, setIndiceGrupo] = useState(0);
  const [caixaAtual, setCaixaAtual] = useState("1");
  const [caixaTotal, setCaixaTotal] = useState("1");
  const [qtde, setQtde] = useState("");
  const [previewGerado, setPreviewGerado] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

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
  const grupo = selecionada?.grupos[indiceGrupo] ?? null;

  function limparPrevia() {
    setPreviewGerado(false);
    setSucesso(false);
  }

  function aplicarGrupo(g: GrupoNf | null) {
    // sugestão: 1 de N caixas (21 por caixa), quantidade da 1ª caixa
    const total = g ? Math.max(1, Math.ceil(g.quantidade / 21)) : 1;
    setCaixaAtual("1");
    setCaixaTotal(String(total));
    setQtde(g ? String(Math.min(21, g.quantidade)) : "");
  }

  function escolherNf(numero: string) {
    limparPrevia();
    setNfRetorno(numero);
    setIndiceGrupo(0);
    aplicarGrupo(nfs?.find((n) => n.numero === numero)?.grupos[0] ?? null);
  }

  function escolherGrupo(i: number) {
    limparPrevia();
    setIndiceGrupo(i);
    aplicarGrupo(selecionada?.grupos[i] ?? null);
  }

  const dados: DadosEtiquetaCaixa | null = grupo
    ? {
        reparadora: grupo.reparadora,
        tipo: grupo.tipo,
        status: grupo.status,
        nfRetorno,
        nfPeca: grupo.nfPeca,
        nfServico: grupo.nfServico,
        qtde: qtde.trim(),
        nfEnvio: grupo.nfEnvio,
        caixaAtual: caixaAtual.trim(),
        caixaTotal: caixaTotal.trim(),
      }
    : null;

  async function imprimir() {
    if (!dados) return;
    setErro(null);
    setSucesso(false);
    setImprimindo(true);
    try {
      await imprimirCaixaViaAgente(dados);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ErroImpressaoAgente ? e.message : "Não foi possível imprimir essa etiqueta.");
    }
    setImprimindo(false);
  }

  const estiloCampo: React.CSSProperties = { background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" };
  const rotulo = "block text-xs font-medium mb-1.5";

  return (
    <div>
      <label className={rotulo} style={{ color: "var(--muted)" }}>
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
          onChange={(e) => escolherNf(e.target.value)}
          disabled={imprimindo}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-3"
          style={estiloCampo}
        >
          <option value="">Selecione a NF de Retorno…</option>
          {nfs.map((n) => (
            <option key={n.numero} value={n.numero}>
              {n.numero} — NF envio {n.remessas.join(", ")} · {n.aparelhos} aparelho(s)
            </option>
          ))}
        </select>
      )}

      {selecionada && (
        <>
          <label className={rotulo} style={{ color: "var(--muted)" }}>
            Grupo da caixa (NF envio · status · tipo)
          </label>
          <select
            value={indiceGrupo}
            onChange={(e) => escolherGrupo(Number(e.target.value))}
            disabled={imprimindo || selecionada.grupos.length <= 1}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition mb-3"
            style={estiloCampo}
          >
            {selecionada.grupos.map((g, i) => (
              <option key={i} value={i}>
                {g.nfEnvio} · {g.tipo} - {g.status} · {g.quantidade} aparelho(s)
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={rotulo} style={{ color: "var(--muted)" }}>
                Caixa (atual / total)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  value={caixaAtual}
                  onChange={(e) => {
                    limparPrevia();
                    setCaixaAtual(e.target.value);
                  }}
                  disabled={imprimindo}
                  inputMode="numeric"
                  className="w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                  style={estiloCampo}
                />
                <span style={{ color: "var(--muted)" }}>de</span>
                <input
                  value={caixaTotal}
                  onChange={(e) => {
                    limparPrevia();
                    setCaixaTotal(e.target.value);
                  }}
                  disabled={imprimindo}
                  inputMode="numeric"
                  className="w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                  style={estiloCampo}
                />
              </div>
            </div>
            <div>
              <label className={rotulo} style={{ color: "var(--muted)" }}>
                Qtde nesta caixa
              </label>
              <input
                value={qtde}
                onChange={(e) => {
                  limparPrevia();
                  setQtde(e.target.value);
                }}
                disabled={imprimindo}
                inputMode="numeric"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                style={estiloCampo}
              />
            </div>
          </div>

          {grupo && (
            <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
              Reparadora {grupo.reparadora} · NF Peça {grupo.nfPeca || "em branco"} · NF Serviço{" "}
              {grupo.nfServico || "em branco"}
            </p>
          )}
        </>
      )}

      {previewGerado && dados && (
        <div className="mt-2 mb-1">
          <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
            Prévia da etiqueta
          </p>
          <PreviewEtiquetaCaixa dados={dados} />
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
          disabled={imprimindo || !dados}
          title={!dados ? "Escolha uma NF de Retorno emitida" : undefined}
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
