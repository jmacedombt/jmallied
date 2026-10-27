"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";

type Resultado = {
  nfRemessa: string;
  aparelhosNaNf: number;
  preenchidas: number;
  substituidas: { trade: string; anterior: string | null; novo: string | null }[];
  jaIguais: number;
  semPreOrdemNoArquivo: number;
  foraDoArquivo: number;
};

/**
 * "Pré-Ordem pendente" + botão "Subir Pré-Ordem" na linha da NF do
 * histórico de Bases > Base Orçamentos (pedido explícito, 27/10/2026).
 * Escolhe só o arquivo de Pré-Ordem; o sistema casa com o arquivo de
 * orçamentos guardado dessa NF (mesma ordem, mesma conferência de
 * quantidade/lote/SKU) e preenche todos os aparelhos da NF — ver
 * api/bases/orcamentos/pre-ordem/route.ts. Também aparece (sem o selo)
 * nas NFs que já têm Pré-Ordem, pra dar pra corrigir subindo de novo.
 */
export default function BotaoSubirPreOrdem({
  loteId,
  nfRemessa,
  pendente,
  podeSubir,
}: {
  loteId: string;
  nfRemessa: string;
  pendente: boolean;
  podeSubir: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function enviar(arquivo: File | null) {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    const form = new FormData();
    form.append("loteId", loteId);
    form.append("arquivoPreOrdem", arquivo);
    try {
      const res = await fetch("/api/bases/orcamentos/pre-ordem", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) setErro(data?.error || "Não foi possível subir a Pré-Ordem.");
      else {
        setResultado(data as Resultado);
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <>
      <div className="inline-flex items-center gap-2 flex-wrap">
        {pendente ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
            style={{ color: "#d97706", background: "rgba(217, 119, 6, 0.14)" }}
          >
            Pré-Ordem pendente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap" style={{ color: "#16a34a" }}>
            <CheckCircle2 size={12} /> OK
          </span>
        )}
        {podeSubir && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            title={pendente ? "Subir o arquivo de Pré-Ordem dessa NF" : "Subir de novo a Pré-Ordem dessa NF (corrige o que mudou)"}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition hover:border-[var(--accent2)] disabled:opacity-60 whitespace-nowrap"
            style={
              pendente
                ? { borderColor: "#d97706", color: "#d97706" }
                : { borderColor: "var(--line)", color: "var(--muted)" }
            }
          >
            {enviando ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
            {enviando ? "Conferindo..." : pendente ? "Subir Pré-Ordem" : "Reenviar"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            enviar(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>

      {(erro || resultado) && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => {
            setErro(null);
            setResultado(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl p-5 max-h-[85vh] overflow-y-auto"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                Pré-Ordem — NF {nfRemessa}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setErro(null);
                  setResultado(null);
                }}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            {erro && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{erro}</p>
            )}

            {resultado && (
              <div className="text-sm space-y-2" style={{ color: "var(--ink)" }}>
                <p className="flex items-center gap-2 font-semibold" style={{ color: "#16a34a" }}>
                  <CheckCircle2 size={16} /> Pré-Ordem conferida e gravada
                </p>
                <p>
                  {resultado.aparelhosNaNf} aparelho(s) na NF · <strong>{resultado.preenchidas}</strong> preenchido(s) ·{" "}
                  <strong>{resultado.substituidas.length}</strong> substituído(s) · {resultado.jaIguais} já estava(m) igual(is)
                </p>
                {resultado.semPreOrdemNoArquivo > 0 && (
                  <p style={{ color: "#d97706" }}>
                    {resultado.semPreOrdemNoArquivo} linha(s) do arquivo vieram sem número de Pré-Ordem (coluna D) — esses
                    aparelhos não foram alterados.
                  </p>
                )}
                {resultado.foraDoArquivo > 0 && (
                  <p style={{ color: "#d97706" }}>
                    {resultado.foraDoArquivo} aparelho(s) da NF não estão no arquivo de orçamentos guardado — não foram alterados.
                  </p>
                )}
                {resultado.substituidas.length > 0 && (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                          <th className="px-3 py-1.5 font-medium">Trade Allied</th>
                          <th className="px-3 py-1.5 font-medium">Antes</th>
                          <th className="px-3 py-1.5 font-medium">Agora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.substituidas.map((s) => (
                          <tr key={s.trade} className="border-t" style={{ borderColor: "var(--line)" }}>
                            <td className="px-3 py-1.5">{s.trade}</td>
                            <td className="px-3 py-1.5" style={{ color: "var(--muted)" }}>
                              {s.anterior}
                            </td>
                            <td className="px-3 py-1.5 font-medium">{s.novo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
