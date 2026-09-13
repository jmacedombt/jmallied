/**
 * Exportação em Excel do número da Pré-Ordem — usado no botão
 * "Exportar Pré Ordem (Excel)" e no "Emitir NF - Envio de Pré Ordem" de
 * "7 - Reparo Finalizado" e "8 - Orçamento Reprovado" (ver
 * PainelReparoFinalizado.tsx / PainelOrcamentoReprovado.tsx). Gerado no
 * navegador, mesmo padrão de BotaoResumoPrioridadeBid.tsx /
 * TabelaVariacaoPrecoPecas.tsx (import dinâmico do "xlsx" + XLSX.writeFile).
 */
export type ItemExportacaoPreOrdem = {
  pre_ordem: string | null;
  os_reparadora: string | null;
  trade_allied: string;
};

/** Data/hora "agora" no fuso de Brasília, pro nome do arquivo — mesma
 * lógica usada no Relatório BID e na Variação de Preço. */
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

export async function gerarExcelPreOrdem(itens: ItemExportacaoPreOrdem[], prefixoArquivo: string) {
  const XLSX = await import("xlsx");
  const cabecalho = ["Pré Ordem", "OS Reparadora", "Trade Allied"];
  const corpo = itens.map((i) => [i.pre_ordem || "—", i.os_reparadora || "—", i.trade_allied]);

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);
  planilha["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "Pré Ordem");
  XLSX.writeFile(workbook, `${prefixoArquivo}_${agoraBrasiliaArquivo()}.xlsx`);
}
