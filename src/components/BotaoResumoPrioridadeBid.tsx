"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Download, FileSpreadsheet, X } from "lucide-react";

export type PecaPrioridadeBid = { modelo: string; part_number: string };

/** Data/hora "agora" no fuso de Brasília, pro nome do arquivo exportado —
 * mesma lógica usada no Relatório BID e na Variação de Preço, rodando no
 * navegador (aqui não tem servidor no meio). */
function agoraBrasiliaArquivo(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("day")}${valor("month")}${valor("year")}_${valor("hour")}${valor("minute")}`;
}

// Botão "Resumo" de Pendências BID: abre um pop-up com a relação de Part
// Numbers marcados como Prioridade (peça sem custo no BID e com pedido em
// aberto esperando o cadastro) — pensado pra alguém levar essa lista pro
// GSPN/Samsung e cotar tudo de uma vez, em vez de ir peça por peça na
// tabela. "Copiar todas" copia só os Part Numbers (um por linha, prontos
// pra colar numa busca); "Exportar Excel" gera uma planilha com Modelo e
// Part Number.
export default function BotaoResumoPrioridadeBid({ pecas }: { pecas: PecaPrioridadeBid[] }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function copiarTodas() {
    const texto = pecas.map((p) => p.part_number).join("\n");
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {});
  }

  function exportarExcel() {
    // import dinâmico: a lib "xlsx" só precisa existir no navegador na
    // hora do clique, não no bundle inicial da página.
    import("xlsx").then((XLSX) => {
      const cabecalho = ["Modelo", "Part Number"];
      const corpo = pecas.map((p) => [p.modelo, p.part_number]);

      const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);
      planilha["!cols"] = [{ wch: 24 }, { wch: 20 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, planilha, "Prioridade BID");
      XLSX.writeFile(workbook, `Prioridade_BID_${agoraBrasiliaArquivo()}.xlsx`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={pecas.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm transition hover:border-[var(--accent2)] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        title={pecas.length === 0 ? "Nenhuma peça em prioridade no momento" : undefined}
      >
        <FileSpreadsheet size={15} />
        Resumo{pecas.length > 0 && ` (${pecas.length})`}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 flex flex-col"
            style={{ background: "var(--surface)", borderColor: "var(--line)", maxHeight: "85vh" }}
          >
            <div className="flex items-center justify-between mb-1 shrink-0">
              <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                Part Numbers em Prioridade
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs mb-4 shrink-0" style={{ color: "var(--muted)" }}>
              {pecas.length} peça(s) sem custo no BID com pedido em aberto esperando o cadastro.
            </p>

            <div className="rounded-xl border overflow-auto mb-4 min-h-0" style={{ borderColor: "var(--line)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left sticky top-0" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                    <th className="px-3 py-2 font-medium">Modelo</th>
                    <th className="px-3 py-2 font-medium">Part Number</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((p, i) => (
                    <tr key={`${p.part_number}-${i}`} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                        {p.modelo}
                      </td>
                      <td className="px-3 py-2 font-mono" style={{ color: "#ef4444", fontWeight: 600 }}>
                        {p.part_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={copiarTodas}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--ink)", border: "1px solid var(--line)" }}
              >
                {copiado ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
                {copiado ? "Copiado!" : "Copiar todas"}
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-white transition"
                style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
              >
                <Download size={13} />
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
