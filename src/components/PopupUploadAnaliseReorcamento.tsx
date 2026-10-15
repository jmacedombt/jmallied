"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";

type Resultado = "Aprovado" | "Contra Proposta" | "Reprovado";

type ItemAnalise = { id: string; osReparadora: string; tradeAllied: string; resultado: Resultado };

type ResumoAnalise = {
  linhasNoArquivo: number;
  linhasNaoReconhecidas: number;
  itens: ItemAnalise[];
  pendentesDeEnvio: string[];
  naoEncontradas: string[];
};

const DESTINO: Record<Resultado, { rotulo: string; destino: string; cor: string; fundo: string }> = {
  Aprovado: { rotulo: "Aprovado", destino: "5 - Ag. Peças", cor: "#16a34a", fundo: "rgba(22, 163, 74, 0.12)" },
  "Contra Proposta": { rotulo: "Contra Proposta", destino: "Ag. Contra Proposta", cor: "#2563eb", fundo: "rgba(37, 99, 235, 0.12)" },
  Reprovado: { rotulo: "Reprovado", destino: "8 - Orçamento Reprovado", cor: "#dc2626", fundo: "rgba(220, 38, 38, 0.12)" },
};

/**
 * "Upload Análise Allied" de "4 - Ag. Resposta de Reorçamento" (pedido
 * explícito, 15/10/2026). Fluxo: escolhe o Excel da Allied → o sistema
 * lê a coluna BQ e mostra o resumo (pra onde cada aparelho vai) → só
 * movimenta depois de "Confirmar movimentação". Ver
 * api/operacional/reorcamento/upload-analise/route.ts.
 */
export default function PopupUploadAnaliseReorcamento({
  onFechar,
  onConcluido,
}: {
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resumo, setResumo] = useState<ResumoAnalise | null>(null);
  const [lendo, setLendo] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<{ aprovados: number; contraProposta: number; reprovados: number; falhas: string[] } | null>(null);

  const ocupado = lendo || movendo;

  async function enviar(arq: File, confirmar: boolean) {
    const form = new FormData();
    form.append("arquivo", arq);
    form.append("confirmar", confirmar ? "true" : "false");
    const res = await fetch("/api/operacional/reorcamento/upload-analise", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Não foi possível processar o arquivo.");
    return data;
  }

  async function escolherArquivo(arq: File | null) {
    if (!arq) return;
    setArquivo(arq);
    setResumo(null);
    setConcluido(null);
    setErro(null);
    setLendo(true);
    try {
      const data = await enviar(arq, false);
      setResumo(data.resumo as ResumoAnalise);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
    setLendo(false);
  }

  async function confirmar() {
    if (!arquivo) return;
    setMovendo(true);
    setErro(null);
    try {
      const data = await enviar(arquivo, true);
      setConcluido({
        aprovados: data.aprovados ?? 0,
        contraProposta: data.contraProposta ?? 0,
        reprovados: data.reprovados ?? 0,
        falhas: data.falhas ?? [],
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível movimentar.");
    }
    setMovendo(false);
  }

  const contagem = (r: Resultado) => resumo?.itens.filter((i) => i.resultado === r).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !ocupado && (concluido ? onConcluido() : onFechar())}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <FileUp size={18} style={{ color: "var(--accent2)" }} />
            Upload Análise Allied
          </h2>
          <button
            type="button"
            onClick={() => (concluido ? onConcluido() : onFechar())}
            disabled={ocupado}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Excel da Allied com a análise do reorçamento. O sistema lê a coluna <strong>BQ</strong>: APROVADO vai para 5 -
          Ag. Peças, CONTRA PROPOSTA vai para Ag. Contra Proposta e REPROVADO vai para 8 - Orçamento Reprovado.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            escolherArquivo(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        {!concluido && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={ocupado}
            className="w-full rounded-xl border-2 border-dashed px-4 py-5 text-sm transition hover:border-[var(--accent2)] disabled:opacity-60 mb-4"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface2)" }}
          >
            {lendo ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Lendo o arquivo...
              </span>
            ) : arquivo ? (
              <>
                <strong>{arquivo.name}</strong>
                <span className="block text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Clique para escolher outro arquivo
                </span>
              </>
            ) : (
              "Clique para localizar o Excel da Allied"
            )}
          </button>
        )}

        {resumo && !concluido && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(["Aprovado", "Contra Proposta", "Reprovado"] as Resultado[]).map((r) => (
                <div key={r} className="rounded-lg border p-3" style={{ borderColor: "var(--line)", background: DESTINO[r].fundo }}>
                  <p className="text-xl font-bold" style={{ color: DESTINO[r].cor }}>
                    {contagem(r)}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: "var(--ink)" }}>
                    {DESTINO[r].rotulo}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    → {DESTINO[r].destino}
                  </p>
                </div>
              ))}
            </div>

            {resumo.itens.length > 0 && (
              <div className="rounded-xl border overflow-hidden mb-3 max-h-64 overflow-y-auto" style={{ borderColor: "var(--line)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                      <th className="px-3 py-2 font-medium">OS Reparadora</th>
                      <th className="px-3 py-2 font-medium">Trade Allied</th>
                      <th className="px-3 py-2 font-medium">BQ</th>
                      <th className="px-3 py-2 font-medium">Vai para</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.itens.map((i) => (
                      <tr key={i.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="px-3 py-1.5 font-medium" style={{ color: "var(--ink)" }}>
                          {i.osReparadora}
                        </td>
                        <td className="px-3 py-1.5" style={{ color: "var(--ink)" }}>
                          {i.tradeAllied}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ color: DESTINO[i.resultado].cor, background: DESTINO[i.resultado].fundo }}
                          >
                            {DESTINO[i.resultado].rotulo}
                          </span>
                        </td>
                        <td className="px-3 py-1.5" style={{ color: "var(--muted)" }}>
                          {DESTINO[i.resultado].destino}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(resumo.pendentesDeEnvio.length > 0 || resumo.naoEncontradas.length > 0 || resumo.linhasNaoReconhecidas > 0) && (
              <div className="text-xs rounded-lg border px-3 py-2 mb-3 space-y-1" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
                {resumo.pendentesDeEnvio.length > 0 && (
                  <p>
                    <strong style={{ color: "#b45309" }}>{resumo.pendentesDeEnvio.length}</strong> ignorado(s) por estar com a
                    planilha Complementar <strong>pendente de envio</strong>: {resumo.pendentesDeEnvio.join(", ")}
                  </p>
                )}
                {resumo.naoEncontradas.length > 0 && (
                  <p>
                    <strong>{resumo.naoEncontradas.length}</strong> OS do arquivo não estão em 4 - Ag. Resposta de Reorçamento
                    (não serão alteradas): {resumo.naoEncontradas.slice(0, 30).join(", ")}
                    {resumo.naoEncontradas.length > 30 && "..."}
                  </p>
                )}
                {resumo.linhasNaoReconhecidas > 0 && (
                  <p>
                    <strong>{resumo.linhasNaoReconhecidas}</strong> linha(s) sem OS válida na coluna D ou sem status reconhecido
                    na coluna BQ.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {concluido && (
          <div className="rounded-xl border p-4 mb-4 text-sm" style={{ borderColor: "#22c55e", background: "rgba(34, 197, 94, 0.08)" }}>
            <p className="font-semibold flex items-center gap-2 mb-2" style={{ color: "#16a34a" }}>
              <CheckCircle2 size={16} /> Movimentação concluída
            </p>
            <p style={{ color: "var(--ink)" }}>
              {concluido.aprovados} para 5 - Ag. Peças · {concluido.contraProposta} para Ag. Contra Proposta ·{" "}
              {concluido.reprovados} para 8 - Orçamento Reprovado
            </p>
            {concluido.falhas.length > 0 && (
              <p className="text-xs mt-2" style={{ color: "#dc2626" }}>
                Não movimentados (já tinham saído da etapa ou deu erro): {concluido.falhas.join(", ")}
              </p>
            )}
          </div>
        )}

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {concluido ? (
            <button
              type="button"
              onClick={onConcluido}
              className="rounded-lg text-white text-sm font-medium px-5 py-2.5 transition"
              style={{ background: "var(--accent2)" }}
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onFechar}
                disabled={ocupado}
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={ocupado || !resumo || resumo.itens.length === 0}
                className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#16a34a" }}
              >
                {movendo ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {movendo ? "Movimentando..." : `Confirmar movimentação${resumo ? ` (${resumo.itens.length})` : ""}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
