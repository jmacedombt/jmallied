"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { lerLinhaGspn, type LinhaGspnImportada } from "@/lib/gspn";
import BarraProgresso from "@/components/BarraProgresso";

// Arquivos grandes (milhares de linhas) são divididos em lotes menores e
// enviados um de cada vez, em vez de tudo numa única requisição — no plano
// gratuito da Vercel toda função tem um limite rígido de 10s de execução, e
// uma planilha grande inteira não caberia nisso. Cada lote é rápido o
// suficiente pra nunca chegar perto desse limite, e o usuário acompanha o
// progresso lote a lote na tela.
const TAMANHO_LOTE = 400;

type Resultado = {
  linhasNoArquivo: number;
  linhasInvalidas: number;
  chamadosNovos: number;
  chamadosAtualizados: number;
  pecasCasadasOrcamento: number;
  pecasNaoCasadasOrcamento: number;
};

async function lerRespostaJson(res: Response): Promise<{ dado: unknown; erro?: string }> {
  const texto = await res.text();
  try {
    return { dado: JSON.parse(texto) };
  } catch {
    return {
      dado: null,
      erro:
        res.status === 504
          ? "tempo esgotado no servidor"
          : `resposta inesperada do servidor (código ${res.status})`,
    };
  }
}

export default function ImportarGspnForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(false);
  const [percentual, setPercentual] = useState(0);
  const [fase, setFase] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  function registrar(linha: string) {
    setLog((atual) => [...atual, linha]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setCarregando(true);
    setPercentual(0);
    setErro(null);
    setResultado(null);
    setLog([]);
    setFase("Lendo o arquivo...");

    try {
      const bytes = await arquivo.arrayBuffer();
      const XLSX = await import("xlsx");

      let linhasBrutas: unknown[][];
      try {
        const workbook = XLSX.read(new Uint8Array(bytes), { type: "array" });
        const planilha = workbook.Sheets[workbook.SheetNames[0]];
        linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];
      } catch {
        setErro("Não consegui ler esse arquivo. Confirme que é uma planilha .xlsx válida.");
        setCarregando(false);
        return;
      }

      const linhasDados = linhasBrutas.slice(1); // primeira linha é cabeçalho

      const linhasValidas: LinhaGspnImportada[] = [];
      let linhasInvalidas = 0;
      for (const linha of linhasDados) {
        const lida = lerLinhaGspn(linha);
        if (!lida) {
          linhasInvalidas += 1;
          continue;
        }
        linhasValidas.push(lida);
      }

      if (linhasValidas.length === 0) {
        setErro("Não encontrei nenhuma linha com OS Reparadora válida (10 números) nesse arquivo.");
        setCarregando(false);
        return;
      }

      // dedup dentro do próprio arquivo — mantém a última ocorrência de cada
      // OS Reparadora, já que "sempre considera a última versão".
      const mapaArquivo = new Map<string, LinhaGspnImportada>();
      for (const l of linhasValidas) mapaArquivo.set(l.os_reparadora, l);
      const linhasUnicas = Array.from(mapaArquivo.values());

      const lotes: LinhaGspnImportada[][] = [];
      for (let i = 0; i < linhasUnicas.length; i += TAMANHO_LOTE) {
        lotes.push(linhasUnicas.slice(i, i + TAMANHO_LOTE));
      }

      registrar(
        `Arquivo lido: ${linhasDados.length} linha(s), ${linhasUnicas.length} chamado(s) válido(s) e únicos, divididos em ${lotes.length} lote(s).`
      );

      let chamadosNovos = 0;
      let chamadosAtualizados = 0;
      let pecasCasadasOrcamento = 0;

      for (let i = 0; i < lotes.length; i++) {
        const lote = lotes[i];
        setFase(`Processando lote ${i + 1} de ${lotes.length} (${lote.length} chamados)...`);

        let res: Response;
        try {
          res = await fetch("/api/bases/gspn/importar/lote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linhas: lote }),
          });
        } catch {
          setErro(
            `Falha de conexão no lote ${i + 1} de ${lotes.length}. Nada foi perdido: pode subir o mesmo arquivo de novo, os lotes já processados só serão atualizados de novo sem problema.`
          );
          setCarregando(false);
          return;
        }

        const { dado, erro: erroLeitura } = await lerRespostaJson(res);
        const resposta = dado as { error?: string; chamadosNovos?: number; chamadosAtualizados?: number; pecasCasadasOrcamento?: number } | null;

        if (!res.ok || !resposta) {
          setErro(
            `Falha no lote ${i + 1} de ${lotes.length}: ${resposta?.error || erroLeitura || "erro desconhecido"}. Nada foi perdido: pode subir o mesmo arquivo de novo, os lotes já processados só serão atualizados de novo sem problema.`
          );
          setCarregando(false);
          return;
        }

        chamadosNovos += resposta.chamadosNovos ?? 0;
        chamadosAtualizados += resposta.chamadosAtualizados ?? 0;
        pecasCasadasOrcamento += resposta.pecasCasadasOrcamento ?? 0;

        registrar(
          `Lote ${i + 1}/${lotes.length} concluído: ${resposta.chamadosNovos ?? 0} novo(s), ${
            resposta.chamadosAtualizados ?? 0
          } atualizado(s).`
        );
        setPercentual(Math.round(((i + 1) / lotes.length) * 100));
      }

      setFase("Finalizando...");
      const pecasNaoCasadasOrcamento = linhasUnicas.length - pecasCasadasOrcamento;

      const resFinal = await fetch("/api/bases/gspn/importar/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arquivoNome: arquivo.name,
          linhasNoArquivo: linhasDados.length,
          linhasInvalidas,
          chamadosNovos,
          chamadosAtualizados,
          pecasCasadasOrcamento,
          pecasNaoCasadasOrcamento,
        }),
      });

      if (!resFinal.ok) {
        registrar("Todos os chamados foram importados, mas não consegui gravar o resumo da importação.");
      }

      setResultado({
        linhasNoArquivo: linhasDados.length,
        linhasInvalidas,
        chamadosNovos,
        chamadosAtualizados,
        pecasCasadasOrcamento,
        pecasNaoCasadasOrcamento,
      });
      if (inputRef.current) inputRef.current.value = "";
      setNomeArquivo(null);
      router.refresh();
    } catch {
      setErro("Falha inesperada ao processar o arquivo. Tente novamente.");
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
          disabled={carregando || !nomeArquivo}
          className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          {carregando ? "Importando..." : "Carregar base"}
        </button>

        <p className="text-xs w-full sm:w-auto" style={{ color: "var(--muted)" }}>
          Sempre considera a última versão: atualiza cada chamado pela OS Reparadora (não apaga o que não vier no
          arquivo) e já propaga as peças pra tabela de orçamentos. Arquivos grandes são enviados em lotes, então o
          sistema não trava.
        </p>
      </form>

      {carregando && (
        <>
          <BarraProgresso percentual={percentual} rotulo={fase} />
          {log.length > 0 && (
            <div
              className="mt-3 max-h-40 overflow-y-auto rounded-lg border px-3 py-2 text-xs font-mono space-y-0.5"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--muted)" }}
            >
              {log.map((linha, i) => (
                <p key={i}>{linha}</p>
              ))}
            </div>
          )}
        </>
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
