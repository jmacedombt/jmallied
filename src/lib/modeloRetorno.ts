/**
 * Planilha "Modelo de Retorno" de "Ag. Emissão de Nota Fiscal" — mesmo
 * formato/colunas do arquivo-modelo enviado pelo Rafael (aba com o
 * nome da data, DDMMAAAA), sempre Aprovados primeiro e Recusados
 * depois (pedido explícito). Gerada no navegador, mesmo padrão de
 * lib/exportN3.ts e lib/preOrdemExport.ts (import dinâmico do "xlsx" +
 * XLSX.writeFile) — não muda nada no banco, só baixa o arquivo.
 */
import { type CamposValorVigente, calcularMaoDeObraVigente } from "@/lib/orcamentos";
import { pecasVigentes, type PecaPosicionada } from "@/lib/exportN3";

export type ItemModeloRetorno = CamposValorVigente & {
  nf_remessa_allied: string;
  os_care_allied: string | null;
  trade_allied: string;
  imei_allied: string | null;
  sku: string | null;
  observacao_tecnica_reparadora: string | null;
  motivo_reprova: string | null;
  nf_retorno_numero: string | null;
  nf_mao_de_obra_numero: string | null;
  nf_mao_de_obra_valor: number | null;
  nf_pecas_numero: string | null;
  nf_pecas_valor: number | null;
};

// "Reparadora Terceira" vem igual em toda linha do modelo enviado — é a
// própria empresa (Grupo J.Macedo), não um dado por aparelho.
const REPARADORA_TERCEIRA = "J MACEDO";

const CABECALHO = [
  "Reparadora Terceira",
  "NF Envio Allied",
  "OS Care",
  "Trade",
  "IMEI",
  "SKU",
  "Peça 1", "Peça 2", "Peça 3", "Peça 4", "Peça 5", "Peça 6", "Peça 7", "Peça 8", "Peça 9", "Peça 10",
  "Peça Add 1", "Peça Add 2", "Peça Add 3", "Peça Add 4", "Peça Add 5",
  "Valor Peça 1", "Valor Peça 2", "Valor Peça 3", "Valor Peça 4", "Valor Peça 5",
  "Valor Peça 6", "Valor Peça 7", "Valor Peça 8", "Valor Peça 9", "Valor Peça 10",
  "Valor Peça Add 1", "Valor Peça Add 2", "Valor Peça Add 3", "Valor Peça Add 4", "Valor Peça Add 5",
  "MO",
  "Observação Reparadora",
  "Motivo Reprova",
  "Tipo de Retorno",
  "NF Retorno",
  "NF Peça",
  "NF Serviço",
  "Valor Total NF Peça",
  "Valor Total NF Serviço",
];

// Formato de moeda aplicado nas colunas monetárias da planilha (pedido
// explícito) — os índices saem calculados a partir do próprio CABECALHO
// (toda coluna "Valor ..." + "MO"), pra não precisar atualizar números
// mágicos se a ordem das colunas mudar. O valor da célula continua
// numérico (não vira texto) — só a exibição do Excel que já sai em
// "R$ 1.234,56", mantendo somas/fórmulas funcionando normalmente.
const FORMATO_MOEDA = '"R$" #,##0.00';
const COLUNAS_MOEDA = CABECALHO.reduce<number[]>((colunas, rotulo, indice) => {
  if (rotulo === "MO" || rotulo.startsWith("Valor")) colunas.push(indice);
  return colunas;
}, []);

/** "Part Number - Peça Solução" (pedido explícito) — cai pro código
 * sozinho quando a peça não tem solução cadastrada no BID. */
function formatarPeca(codigo: string, solucoesPorPartNumber: Record<string, string>): string {
  const solucao = solucoesPorPartNumber[codigo.trim()];
  return solucao ? `${codigo} - ${solucao}` : codigo;
}

/** Separa as peças vigentes (ver pecasVigentes) em 2 grupos de posição
 * fixa — 10 "normais" (Peça 1..10) e 5 "Add" (Peça Add 1..5) — cada
 * grupo na SUA própria coluna, sem a compactação usada na exportação
 * N3 (lá as Add preenchem os buracos das normais; aqui o modelo tem
 * coluna própria pra cada Add). */
function montarSlots(item: CamposValorVigente): { normais: (PecaPosicionada | null)[]; add: (PecaPosicionada | null)[] } {
  const normais: (PecaPosicionada | null)[] = new Array(10).fill(null);
  const add: (PecaPosicionada | null)[] = new Array(5).fill(null);
  for (const p of pecasVigentes(item)) {
    const n = Number(p.posicao);
    if (Number.isInteger(n) && n >= 1 && n <= 10) {
      normais[n - 1] = p;
    } else if (p.posicao.startsWith("Extra ")) {
      const idx = Number(p.posicao.replace("Extra ", "")) - 1;
      if (idx >= 0 && idx < 5) add[idx] = p;
    }
  }
  return { normais, add };
}

function linhaItem(
  item: ItemModeloRetorno,
  tipo: "Aprovado" | "Reprovado",
  solucoesPorPartNumber: Record<string, string>
): (string | number)[] {
  const { normais, add } = montarSlots(item);
  const linha: (string | number)[] = [
    REPARADORA_TERCEIRA,
    item.nf_remessa_allied || "",
    item.os_care_allied || "",
    item.trade_allied || "",
    item.imei_allied || "",
    item.sku || "",
  ];
  for (const slot of normais) linha.push(slot ? formatarPeca(slot.codigo, solucoesPorPartNumber) : "");
  for (const slot of add) linha.push(slot ? formatarPeca(slot.codigo, solucoesPorPartNumber) : "");
  for (const slot of normais) linha.push(slot ? slot.valor : "");
  for (const slot of add) linha.push(slot ? slot.valor : "");
  linha.push(calcularMaoDeObraVigente(item));
  linha.push(item.observacao_tecnica_reparadora || "");
  linha.push(tipo === "Reprovado" ? item.motivo_reprova || "" : "");
  linha.push(tipo);
  linha.push(item.nf_retorno_numero || "");
  if (tipo === "Aprovado") {
    linha.push(item.nf_pecas_numero || "", item.nf_mao_de_obra_numero || "", item.nf_pecas_valor ?? "", item.nf_mao_de_obra_valor ?? "");
  } else {
    linha.push("", "", "", "");
  }
  return linha;
}

function dataArquivoBrasilia(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("day")}${valor("month")}${valor("year")}`;
}

/** Gera e baixa a planilha "Modelo de Retorno" — Aprovados sempre
 * primeiro, Recusados depois (pedido explícito). Não grava nada no
 * banco nem muda status — só o Excel. */
export async function gerarExcelModeloRetorno(
  aprovados: ItemModeloRetorno[],
  recusados: ItemModeloRetorno[],
  solucoesPorPartNumber: Record<string, string>
) {
  const XLSX = await import("xlsx");

  const corpo = [
    ...aprovados.map((item) => linhaItem(item, "Aprovado", solucoesPorPartNumber)),
    ...recusados.map((item) => linhaItem(item, "Reprovado", solucoesPorPartNumber)),
  ];

  const planilha = XLSX.utils.aoa_to_sheet([CABECALHO, ...corpo]);
  planilha["!cols"] = CABECALHO.map(() => ({ wch: 16 }));

  // Aplica o formato de moeda (R$) em toda célula numérica das colunas
  // monetárias — pula célula vazia (peça/valor não preenchido nessa
  // posição) e linha do cabeçalho (r: 0).
  for (let linha = 0; linha < corpo.length; linha++) {
    for (const coluna of COLUNAS_MOEDA) {
      const endereco = XLSX.utils.encode_cell({ r: linha + 1, c: coluna });
      const celula = planilha[endereco];
      if (celula && typeof celula.v === "number") {
        celula.z = FORMATO_MOEDA;
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  const data = dataArquivoBrasilia();
  XLSX.utils.book_append_sheet(workbook, planilha, data);
  XLSX.writeFile(workbook, `Modelo_de_Retorno_${data}.xlsx`);
}
