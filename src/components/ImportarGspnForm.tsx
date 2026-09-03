"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { uploadComProgresso } from "@/lib/uploadComProgresso";
import BarraProgresso from "@/components/BarraProgresso";

type Resultado = {
  linhasNoArquivo: number;
  linhasInvalidas: number;
  chamadosNovos: number;
  chamadosAtualizados: number;
  pecasCasadasOrcamento: number;
  pecasNaoCasadasOrcamento: number;
};

export default function ImportarGspnForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(false);
  const [percentual, setPercentual] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setCarregando(true);
    setPercentual(0);
    setErro(null);
    setResultado(null);
    setNomeArquivo(arquivo.name);

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const { ok, data } = await uploadComProgresso("/api/bases/gspn/importar", formData, setPercentual);
      const resposta = data as (Resultado & { error?: string }) | null;

      if (!ok) {
        setErro(resposta?.error || "Não foi possível importar a Base GSPN.");
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
          {carregando ? "Importando..." : "Carregar base"}
        </button>

        <p className="text-xs w-full sm:w-auto" style={{ color: "var(--muted)" }}>
          Sempre considera a última versão: atualiza cada chamado pela OS Reparadora (não apaga o que não vier no
          arquivo) e já propaga as peças pra tabela de orçamentos.
        </p>
      </form>

      {carregando && (
        <BarraProgresso
          percentual={percentual}
          rotulo={percentual < 100 ? "Enviando arquivo..." : "Processando no servidor..."}
        />
      )}

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 mt-4">
          <p>
            Importação concluída: <strong>{resultado.chamadosNovos}</strong> chamado(s) novo(s),{" "}
            <strong>{resultado.chamadosAtualizados}</strong> atualizado(s)
            {resultado.linhasInvalidas > 0 && (
              <>
                , <strong>{resultado.linhasInvalidas}</strong> linha(s) sem OS Reparadora válida descartada(s)
              </>
            )}{" "}
            de {resultado.linhasNoArquivo} lida(s) no arquivo.
          </p>
          <p className="mt-1 text-emerald-400/80">
            <strong>{resultado.pecasCasadasOrcamento}</strong> chamado(s) casaram com a base de orçamentos e tiveram
            as peças atualizadas
            {resultado.pecasNaoCasadasOrcamento > 0 && (
              <>
                {" "}
                · <strong className="text-amber-400">{resultado.pecasNaoCasadasOrcamento}</strong> não encontraram
                essa OS Reparadora na base de orçamentos
              </>
            )}
            .
          </p>
        </div>
      )}
    </div>
  );
}
