"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";

/** Nome do arquivo baixado vem do header Content-Disposition da resposta
 * (ex: attachment; filename="BID SANTOS 04092026_1432.xlsx"). */
function extrairNomeArquivo(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "relatorio-bid.xlsx";
}

export default function BotaoGerarRelatorioBid() {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/bases/bid/relatorio", { method: "POST" });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setErro(corpo?.error ?? "Não foi possível gerar o relatório.");
        return;
      }

      const nomeArquivo = extrairNomeArquivo(resposta.headers.get("Content-Disposition"));
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      router.refresh();
    } catch {
      setErro("Não foi possível gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={gerar}
        disabled={gerando}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
        style={{ background: "var(--accent2)", color: "#fff" }}
      >
        <FileSpreadsheet size={16} />
        {gerando ? "Gerando relatório..." : "Gerar relatório"}
      </button>
      {erro && (
        <p className="text-xs mt-2" style={{ color: "#ef4444" }}>
          {erro}
        </p>
      )}
    </div>
  );
}
