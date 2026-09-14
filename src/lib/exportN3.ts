/**
 * Exportação "Exportar para o N3" de "7 - Reparo Finalizado" — formato
 * exato passado pelo Rafael como exemplo (arquivo "LOTE 2 - GSPN PARA
 * N3 - 09-07-26.xlsx"): mesmas 28 colunas, mesma ordem, mesmos rótulos
 * (inclusive o espaço duplo em "TOTAL DE  PEÇAS" do arquivo original).
 * Gerado no navegador, mesmo padrão de lib/preOrdemExport.ts (import
 * dinâmico do "xlsx" + XLSX.writeFile).
 */
import {
  type CamposValorVigente,
  type PecaContraProposta,
  calcularMaoDeObraVigente,
} from "@/lib/orcamentos";

export type ItemExportacaoN3 = CamposValorVigente & {
  os_reparadora: string | null;
  os_care_allied: string | null;
  nf_remessa_allied: string;
  sku: string | null;
  pre_ordem: string | null;
};

type SlotPeca = { codigo: string; valor: number } | null;
type PecaPosicionada = { posicao: string; codigo: string; valor: number };

/**
 * As peças de cada orçamento (PEÇA N/VLR. PEÇA N) seguem a MESMA
 * cascata de valor VIGENTE usada em Mão de Obra/Venda de Peças (ver
 * calcularMaoDeObraVigente/calcularVendaPecasVigente): reorçamento
 * aprovado (se tiver) > contra proposta ajustada (se tiver) >
 * validação original. As colunas cruas custo_peca_N do orçamento NÃO
 * são usadas aqui — elas guardam só o custo de cadastro, não a Venda
 * de Peça (que sempre vem recalculada contra a Base Peças vigente,
 * igual em Validação de Orçamentos/Contra Proposta/Reorçamento) — usar
 * custo_peca_N fazia a coluna VLR. PEÇA N sair sempre zerada.
 */
function pecasVigentes(o: CamposValorVigente): PecaPosicionada[] {
  if (o.aprovado_reorcamento_em && o.reorcamento_detalhe) {
    return o.reorcamento_detalhe.pecas.map((p) => ({ posicao: p.posicao, codigo: p.codigo, valor: p.vendaPeca ?? 0 }));
  }
  if (o.contra_proposta_ajustado && o.contra_proposta_pecas) {
    return (o.contra_proposta_pecas as PecaContraProposta[]).map((p) => ({
      posicao: p.posicao,
      codigo: p.codigo,
      valor: p.vendaNova ?? 0,
    }));
  }
  return (o.validacao_snapshot?.pecas ?? []).map((p) => ({ posicao: p.posicao, codigo: p.codigo, valor: p.vendaPeca ?? 0 }));
}

/**
 * Monta as 10 posições de Peça/Valor pra exportação: as peças
 * "normais" (posição "1".."10") mantêm exatamente a posição em que
 * estão gravadas no orçamento — sem reordenar nem compactar buracos.
 * Se existir Peça Add (posição "Extra 1".."Extra 5", descoberta durante
 * o reparo — ver Reorçamento em PainelAgReparo.tsx), cada uma entra
 * logo após a ÚLTIMA posição de peça normal que estiver preenchida: 5
 * peças preenchidas → add começa na 6ª; 3 peças preenchidas → add
 * começa na 4ª; e assim por diante. Máximo de 10 posições no total
 * (igual ao arquivo modelo) — Add que não couber fica de fora.
 */
export function montarPecasParaExportacaoN3(o: CamposValorVigente): SlotPeca[] {
  const slots: SlotPeca[] = new Array(10).fill(null);
  const pecas = pecasVigentes(o);
  let ultimaPosicaoPreenchida = -1;

  for (const p of pecas) {
    const n = Number(p.posicao);
    if (Number.isInteger(n) && n >= 1 && n <= 10) {
      slots[n - 1] = { codigo: p.codigo, valor: p.valor };
      if (n - 1 > ultimaPosicaoPreenchida) ultimaPosicaoPreenchida = n - 1;
    }
  }

  const adds = pecas
    .filter((p) => p.posicao.startsWith("Extra "))
    .sort((a, b) => Number(a.posicao.replace("Extra ", "")) - Number(b.posicao.replace("Extra ", "")));

  let posicao = ultimaPosicaoPreenchida + 1;
  for (const add of adds) {
    if (posicao >= 10) break;
    slots[posicao] = { codigo: add.codigo, valor: add.valor };
    posicao++;
  }

  return slots;
}

const CABECALHO_N3 = [
  "DATA_ENCERRAMENTO",
  "SERVICE",
  "OS CARE ALLIED",
  "NF REMESSA",
  "SKU",
  "PRÉ ORDEM",
  "VLR. M.O",
  "PEÇA 1",
  "VLR. PEÇA 1",
  "PEÇA 2",
  "VLR. PEÇA 2",
  "PEÇA 3",
  "VLR. PEÇA 3",
  "PEÇA 4",
  "VLR. PEÇA 4",
  "PEÇA 5",
  "VLR. PEÇA 5",
  "PEÇA 6",
  "VLR. PEÇA 6",
  "PEÇA 7",
  "VLR. PEÇA 7",
  "PEÇA 8",
  "VLR. PEÇA 8",
  "PEÇA 9",
  "VLR. PEÇA 9",
  "PEÇA 10",
  "VLR. PEÇA 10",
  "TOTAL DE  PEÇAS",
];

/** Data de hoje (fuso Brasília) no formato DD/MM/AAAA — vai igual em
 * toda linha do arquivo: é a data em que a base está sendo gerada, não
 * uma data por aparelho. */
function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

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

export async function gerarExcelExportacaoN3(itens: ItemExportacaoN3[]) {
  const XLSX = await import("xlsx");
  const dataEncerramento = hojeBrasilia();

  const corpo = itens.map((item) => {
    const slots = montarPecasParaExportacaoN3(item);
    const totalPecas = slots.reduce((soma, s) => soma + (s?.valor ?? 0), 0);
    const linha: (string | number)[] = [
      dataEncerramento,
      item.os_reparadora || "",
      item.os_care_allied || "",
      item.nf_remessa_allied || "",
      item.sku || "",
      item.pre_ordem || "",
      calcularMaoDeObraVigente(item),
    ];
    for (const slot of slots) {
      linha.push(slot?.codigo ?? "", slot?.valor ?? "");
    }
    linha.push(totalPecas);
    return linha;
  });

  const planilha = XLSX.utils.aoa_to_sheet([CABECALHO_N3, ...corpo]);
  planilha["!cols"] = CABECALHO_N3.map(() => ({ wch: 14 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "N3");
  XLSX.writeFile(workbook, `Exportacao_N3_${agoraBrasiliaArquivo()}.xlsx`);
}
