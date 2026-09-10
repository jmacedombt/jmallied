"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2, UploadCloud, X } from "lucide-react";

type Resultado = {
  linhasNoArquivo: number;
  linhasNaoReconhecidas: number;
  casadas: number;
  naoEncontradas: number;
  aprovados: number;
  contraProposta: number;
  reprovados: number;
};

// tempo que o resumo do resultado fica visível antes do pop-up se fechar
// sozinho — dá pra pessoa ler os números antes de sumir.
const FECHAR_SOZINHO_MS = 2200;

// Pop-up do botão "Upload (aprovação de orçamentos)" em "3 - Ag.
// Resposta de Orçamento" — sobe o arquivo que a Allied manda de volta
// (Aprovado/Contra Proposta/Reprovado por OS Reparadora) e casa cada
// linha com o aparelho correspondente que estiver esperando nessa etapa.
// Só marca o resultado — o avanço de etapa de verdade só acontece no
// botão "Confirmar" da tela. Depois de processar com sucesso, o pop-up
// se fecha sozinho (não fica esperando a pessoa clicar em "Fechar") e
// avisa o componente pai pra destacar o botão "Confirmar".
export default function PopupUploadAprovacao({ onFechar, onAtualizado }: { onFechar: () => void; onAtualizado: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function enviar() {
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setEnviando(true);
    setErro(null);
    setResultado(null);

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const res = await fetch("/api/operacional/orcamentos/upload-aprovacao", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível processar o arquivo.");
      } else {
        setResultado(data);
        onAtualizado();
        // mostra o resumo por um instante e fecha sozinho — o próximo
        // passo (Confirmar) já fica piscando na tela de trás.
        window.setTimeout(() => onFechar(), FECHAR_SOZINHO_MS);
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <UploadCloud size={18} style={{ color: "var(--accent2)" }} />
            Upload (aprovação de orçamentos)
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
          Suba o arquivo que a Allied manda de volta com o resultado (Aprovado / Contra Proposta / Reprovado) de cada
          orçamento — a linha é casada pela OS Reparadora com o que estiver esperando nessa etapa. Isso só marca o
          resultado; o avanço de etapa acontece depois, no botão &quot;Confirmar&quot;.
        </p>

        <label
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition hover:border-[var(--accent2)] mb-3"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <UploadCloud size={16} />
          {nomeArquivo || "Escolher arquivo .xlsx"}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>
        )}

        {resultado && (
          <div
            className="text-sm rounded-lg px-3 py-2.5 mb-3 space-y-1"
            style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "#16a34a" }}
          >
            <p>
              <strong>{resultado.casadas}</strong> aparelho(s) casado(s) de {resultado.linhasNoArquivo} linha(s) lida(s)
              — <strong>{resultado.aprovados}</strong> aprovado(s), <strong>{resultado.contraProposta}</strong> contra
              proposta, <strong>{resultado.reprovados}</strong> reprovado(s).
            </p>
            {(resultado.naoEncontradas > 0 || resultado.linhasNaoReconhecidas > 0) && (
              <p className="flex items-center gap-1.5" style={{ color: "#b45309" }}>
                <AlertTriangle size={12} />
                {resultado.naoEncontradas > 0 && <>{resultado.naoEncontradas} OS Reparadora sem aparelho esperando nessa etapa. </>}
                {resultado.linhasNaoReconhecidas > 0 && <>{resultado.linhasNaoReconhecidas} linha(s) não reconhecida(s).</>}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !nomeArquivo}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
