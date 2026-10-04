import * as XLSX from "xlsx";

/**
 * "Movimentar" (menu Operacional, pedido explícito, 03/10/2026) — lê o
 * arquivo subido (.xlsx/.xls ou .txt) com a lista de Trade Allied/OS
 * Reparadora, um valor por linha (.txt) ou por célula da primeira coluna
 * (.xlsx — mesma convenção de leitura usada em
 * api/bases/orcamentos/importar/route.ts). Não tenta adivinhar
 * cabeçalho: um valor que não bater com nenhum orçamento simplesmente
 * aparece como "não encontrado" na busca (ver /api/operacional/
 * movimentar/buscar/route.ts) — inofensivo se a primeira linha for um
 * título solto.
 */
export function lerListaIdentificadores(bytes: Buffer, nomeArquivo: string): string[] {
  const ehTxt = nomeArquivo.toLowerCase().endsWith(".txt");

  let valoresBrutos: unknown[];
  if (ehTxt) {
    valoresBrutos = bytes.toString("utf-8").split(/\r?\n/);
  } else {
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const planilha = workbook.Sheets[workbook.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];
    valoresBrutos = linhas.map((linha) => linha[0]);
  }

  const vistos = new Set<string>();
  const valores: string[] = [];
  for (const bruto of valoresBrutos) {
    const valor = String(bruto ?? "").trim();
    if (!valor || vistos.has(valor)) continue;
    vistos.add(valor);
    valores.push(valor);
  }
  return valores;
}
