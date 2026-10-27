"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck2, Loader2, UploadCloud, X } from "lucide-react";

/**
 * "NF temporária" + "Definir NF definitiva" na linha da NF do histórico
 * de Bases > Base Orçamentos (pedido explícito, 27/10/2026). Sobe a Base
 * de Orçamentos definitiva (com a NF) e, se tiver, a Pré-Ordem — ver
 * api/bases/orcamentos/lotes/[id]/definir-nf.
 */
export default function BotaoDefinirNf({ loteId, nfTemporaria, podeSubir }: { loteId: string; nfTemporaria: string; podeSubir: boolean }) {
  const router = useRouter();
  const refBase = useRef<HTMLInputElement>(null);
  const refPre = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [nomeBase, setNomeBase] = useState<string | null>(null);
  const [nomePre, setNomePre] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function enviar() {
    const base = refBase.current?.files?.[0];
    if (!base) return;
    setEnviando(true);
    setErro(null);
    const form = new FormData();
    form.append("arquivo", base);
    const pre = refPre.current?.files?.[0];
    if (pre) form.append("arquivoPreOrdem", pre);
    try {
      const res = await fetch(`/api/bases/orcamentos/lotes/${loteId}/definir-nf`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) setErro(data?.error || "Não foi possível definir a NF.");
      else {
        const p = data.preOrdem;
        setOk(
          `NF ${data.nfTemporaria} trocada por ${data.nfDefinitiva} em ${data.aparelhos} aparelho(s).` +
            (p ? ` Pré-Ordem: ${p.preenchidas} preenchida(s), ${p.substituidas.length} substituída(s).` : " Pré-Ordem continua pendente — suba depois na linha da NF.")
        );
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  const estiloArquivo = { borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface2)" };

  return (
    <>
      <div className="inline-flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
          style={{ color: "#7c3aed", background: "rgba(124, 58, 237, 0.14)" }}
          title="NF criada pelo sistema porque o arquivo veio sem NF Remessa"
        >
          NF temporária
        </span>
        {podeSubir && (
          <button
            type="button"
            onClick={() => {
              setAberto(true);
              setErro(null);
              setOk(null);
              setNomeBase(null);
              setNomePre(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition"
            style={{ borderColor: "#7c3aed", color: "#7c3aed" }}
          >
            <FileCheck2 size={12} /> Definir NF definitiva
          </button>
        )}
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !enviando && setAberto(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl p-5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                Definir NF definitiva — {nfTemporaria}
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={enviando}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            {ok ? (
              <>
                <p className="text-sm flex items-start gap-2 mb-4" style={{ color: "#16a34a" }}>
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {ok}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    className="rounded-lg text-white text-sm font-medium px-5 py-2.5"
                    style={{ background: "var(--accent2)" }}
                  >
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
                  Suba a <strong>Base de Orçamentos definitiva</strong> (com a NF Remessa na coluna B) e, se já tiver, a{" "}
                  <strong>Pré-Ordem</strong>. O sistema confere se são os mesmos aparelhos (pelo Trade Allied), troca a NF
                  temporária pela definitiva em todo o sistema e preenche a Pré-Ordem. Análise, peças e valores dos
                  aparelhos não mudam.
                </p>

                <div className="flex flex-col gap-2 mb-4">
                  <label className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer" style={estiloArquivo}>
                    <UploadCloud size={16} /> {nomeBase || "Base de Orçamentos definitiva (.xlsx) — obrigatório"}
                    <input
                      ref={refBase}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setNomeBase(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer" style={estiloArquivo}>
                    <UploadCloud size={16} /> {nomePre || "Pré-Ordem (.xlsx) — opcional"}
                    <input
                      ref={refPre}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setNomePre(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                </div>

                {erro && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    disabled={enviando}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface2)]"
                    style={{ color: "var(--muted)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={enviar}
                    disabled={enviando || !nomeBase}
                    className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 disabled:opacity-50"
                    style={{ background: "#7c3aed" }}
                  >
                    {enviando ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
                    {enviando ? "Conferindo..." : "Conferir e definir NF"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
