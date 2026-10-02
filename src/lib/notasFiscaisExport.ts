/**
 * Exportação em Excel da Relação de Notas Fiscais (menu Operacional >
 * Notas Fiscais) — mesmo padrão de lib/preOrdemExport.ts (import
 * dinâmico do "xlsx" + XLSX.writeFile). Um item aqui é um grupo por NF
 * Remessa, no mesmo formato devolvido por GET
 * /api/operacional/notas-fiscais.
 */
export type ItemExportacaoNotaFiscal = {
  nfRemessa: string;
  quantidade: number;
  nfMaoDeObraNumero: string | null;
  nfMaoDeObraValor: number | null;
  nfPecasNumero: string | null;
  nfPecasValor: number | null;
  nfRetornoNumero: string | null;
  nfRetornoValor: number | null;
  situacao: string;
  ultimaAtualizacao: string;
};

/** Data/hora "agora" no fuso de Brasília, pro nome do arquivo — mesma
 * lógica usada no Relatório BID, na Variação de Preço e no Pré Ordem. */
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

export async function gerarExcelNotasFiscais(itens: ItemExportacaoNotaFiscal[]) {
  const XLSX = await import("xlsx");
  const cabecalho = [
    "NF Remessa",
    "Quantidade",
    "NF Mão de Obra (Nº)",
    "NF Mão de Obra (Valor)",
    "NF Peças (Nº)",
    "NF Peças (Valor)",
    "NF Retorno (Nº)",
    "NF Retorno (Valor)",
    "Situação",
    "Última Atualização",
  ];
  const corpo = itens.map((i) => [
    i.nfRemessa,
    i.quantidade,
    i.nfMaoDeObraNumero || "—",
    i.nfMaoDeObraValor ?? "",
    i.nfPecasNumero || "—",
    i.nfPecasValor ?? "",
    i.nfRetornoNumero || "—",
    i.nfRetornoValor ?? "",
    i.situacao,
    new Date(i.ultimaAtualizacao).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  ]);

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);
  planilha["!cols"] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "Notas Fiscais");
  XLSX.writeFile(workbook, `Notas_Fiscais_${agoraBrasiliaArquivo()}.xlsx`);
}
