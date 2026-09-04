"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, RefreshCcw, UploadCloud } from "lucide-react";
import { uploadComProgresso } from "@/lib/uploadComProgresso";
import BarraProgresso from "@/components/BarraProgresso";

type Resultado = {
  linhasNoArquivo: number;
  linhasSemPartNumber: number;
  linhasSemSolucao: number;
  linhasVazias: number;
  linhasDuplicadas: number;
  pecasNovas: number;
  pecasAtualizadas: number;
  solucoesNovas: number;
  pecasPendentes: number;
};

export default function ImportarBidForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(false);
  const [percentual, setPercentual] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [resultadoRecalculo, setResultadoRecalculo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setCarregando(true);
    setPercentual(0);
    setErro(null);
    setResultado(null);
    setResultadoRecalculo(null);
    setNomeArquivo(arquivo.name);

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const { ok, data } = await uploadComProgresso("/api/bases/bid/importar", formData, setPercentual);
      const resposta = data as (Resultado & { error?: string }) | null;

      if (!ok) {
        setErro(resposta?.error || "Não foi possível importar o BID.");
      } else if (resposta) {
        setResultado(resposta);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão ao enviar o arquivo. Tente novamente.");
    }

    setCarregando(false);
  }

  async function recalcular() {
    setRecalculando(true);
    setErro(null);
    setResultadoRecalculo(null);
    try {
      const res = await fetch("/api/bases/bid/recalcular", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível recalcular.");
      } else {
        setResultadoRecalculo(
          `${data.pecasAlteradas} de ${data.pecasVerificadas} peça(s) tiveram o valor atualizado.`
        );
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setRecalculando(false);
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <label
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition hover:border-[var(--accent2)]"
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

        <button
          type="submit"
          disabled={carregando}
          className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          {carregando ? "Importando..." : "Carregar BID"}
        </button>

        <button
          type="button"
          onClick={recalcular}
          disabled={recalculando || carregando}
          title="Refaz o cálculo de custo usando a Base Peças mais recente, sem precisar reimportar o arquivo"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition hover:border-[var(--accent2)] disabled:opacity-50"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <RefreshCcw size={15} className={recalculando ? "animate-spin" : ""} />
          {recalculando ? "Recalculando..." : "Recalcular"}
        </button>

        <div className="group relative inline-flex">
          <Info size={15} style={{ color: "var(--muted)" }} className="cursor-help" />
          <div
            className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 rounded-lg border p-3 text-xs shadow-2xl group-hover:block"
            style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
          >
            O custo é sempre recalculado a partir da Base Peças + faixas de markup — os valores que já vêm no arquivo
            são ignorados.
          </div>
        </div>
      </form>

      {carregando && (
        <BarraProgresso
          percentual={percentual}
          rotulo={percentual < 100 ? "Enviando arquivo..." : "Processando no servidor..."}
        />
      )}

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>
      )}

      {resultadoRecalculo && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mt-4">
          {resultadoRecalculo}
        </p>
      )}

      {resultado && (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 mt-4">
          <p>
            <strong>{resultado.pecasNovas}</strong> peça(s) nova(s), <strong>{resultado.pecasAtualizadas}</strong>{" "}
            atualizada(s), <strong>{resultado.solucoesNovas}</strong> peça(s) solução nova(s) — de{" "}
            {resultado.linhasNoArquivo} linha(s) lidas.
          </p>
          <p className="mt-1 text-emerald-400/80">
            Descartadas: {resultado.linhasSemPartNumber} sem Part Number, {resultado.linhasSemSolucao} sem Peça
            Solução, {resultado.linhasVazias} em branco, {resultado.linhasDuplicadas} duplicadas.
          </p>
          {resultado.pecasPendentes > 0 && (
            <p className="mt-1 text-amber-400">
              {resultado.pecasPendentes} peça(s) ainda sem custo (Part Number não encontrado na Base Peças) — veja em
              Pendências BID.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
