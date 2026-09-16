/**
 * Leitura do export "All Pending" do GSPN — usado só no navegador (upload
 * de arquivo), pra conferir na tela "Ag. Emissão de Nota Fiscal" se
 * alguma OS Reparadora que já está pronta pra sair daqui ainda aparece
 * como pendente no GSPN (ver PainelAgEmissaoNf.tsx).
 *
 * O arquivo que o GSPN gera tem extensão .xls, mas na prática é uma
 * página HTML com uma <table id="ReportTable"> — não um binário de
 * verdade (confirmado no arquivo-modelo enviado: ServiceOrderList...xls
 * abre como HTML). A coluna B (índice 1, contando "Número" como A) é a
 * "SO Nro." — o mesmo número de 10 dígitos gravado em
 * orcamentos.os_reparadora (ver osReparadoraValida em lib/orcamentos.ts).
 *
 * Se algum dia o GSPN passar a gerar um .xls/.xlsx binário de verdade,
 * o fallback abaixo usa a mesma lib "xlsx" (SheetJS) já usada no resto
 * do sistema (ver lib/exportN3.ts, lib/preOrdemExport.ts) — pega a
 * mesma coluna B da primeira aba, sem exigir cabeçalho com nome exato.
 */

function normalizarOsReparadora(valor: string): string {
  return valor.replace(/\D/g, "");
}

function extrairColunaBDoHtml(texto: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(texto, "text/html");
  const tabela = doc.querySelector("table#ReportTable") ?? doc.querySelector("table");
  if (!tabela) {
    throw new Error(
      "Não encontrei nenhuma tabela nesse arquivo — confira se é mesmo o export \"All Pending\" do GSPN."
    );
  }
  const linhas = Array.from(tabela.querySelectorAll("tr"));
  return linhas
    .slice(1) // primeira linha é o cabeçalho ("Número", "SO Nro.", ...)
    .map((tr) => normalizarOsReparadora(tr.children[1]?.textContent ?? ""))
    .filter(Boolean);
}

async function extrairColunaBDoBinario(arquivo: File): Promise<string[]> {
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const planilha = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(planilha, { header: 1 });
  return linhas
    .slice(1)
    .map((linha) => normalizarOsReparadora(String(linha?.[1] ?? "")))
    .filter(Boolean);
}

/** Lê o arquivo "All Pending" (GSPN) e devolve a lista de OS Reparadora
 * (coluna B) que aparecem nele — já limpas (só dígitos), sem duplicar. */
export async function extrairOsReparadoraDoAllPending(arquivo: File): Promise<string[]> {
  const texto = await arquivo.text();
  const pareceHtml = /<html|<table/i.test(texto.slice(0, 4000));

  const valores = pareceHtml ? extrairColunaBDoHtml(texto) : await extrairColunaBDoBinario(arquivo);

  if (valores.length === 0) {
    throw new Error("Não encontrei nenhuma OS Reparadora (coluna B) nesse arquivo.");
  }

  return Array.from(new Set(valores));
}
