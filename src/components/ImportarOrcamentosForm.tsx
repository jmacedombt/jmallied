"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

type Resultado = {
  aparelhosNoArquivo: number;
  linhasInvalidas: number;
  duplicadasNoArquivo: number;
  aparelhosNovosInseridos: number;
  aparelhosDuplicadosIgnorados: number;
  aparelhosReincidentes: number;
  modelosComerciaisUnicos: number;
  skusUnicos: number;
};

export default function ImportarOrcamentosForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setCarregando(true);
    setErro(null);
    setResultado(null);
    setNomeArquivo(arquivo.name);

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const res = await fetch("/api/bases/orcamentos/importar", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Não foi possível importar a base.");
      } else {
        setResultado(data);
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
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition hover:border-allied-accent2"
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
          className="rounded-lg bg-allied-accent hover:bg-allied-accent2 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition shadow-glow"
        >
          {carregando ? "Importando..." : "Carregar base"}
        </button>

        <p className="text-xs w-full sm:w-auto" style={{ color: "var(--muted)" }}>
          Um arquivo = uma NF Remessa Allied. A base acumula entre importações — o
          mesmo aparelho numa NF nova é marcado como reincidente (RRR).
        </p>
      </form>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>
      )}

      {resultado && (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 mt-4">
          <p>
            Importação concluída: <strong>{resultado.aparelhosNovosInseridos}</strong> aparelho(s)
            novo(s), <strong>{resultado.aparelhosDuplicadosIgnorados}</strong> já existente(s)
            ignorado(s){resultado.linhasInvalidas > 0 && (
              <>, <strong>{resultado.linhasInvalidas}</strong> linha(s) inválida(s) descartada(s)</>
            )} de {resultado.aparelhosNoArquivo} lida(s).
          </p>
          <p className="mt-1 text-emerald-400/80">
            {resultado.aparelhosReincidentes > 0 ? (
              <>
                <strong className="text-amber-400">{resultado.aparelhosReincidentes} reincidente(s) (RRR)</strong>{" "}
                identificado(s) neste lote.
              </>
            ) : (
              "Nenhum reincidente identificado neste lote."
            )}
            {" · "}
            {resultado.modelosComerciaisUnicos} modelo(s) comercial(is) · {resultado.skusUnicos} SKU(s) únicos.
          </p>
        </div>
      )}
    </div>
  );
}
