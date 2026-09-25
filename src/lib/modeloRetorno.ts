/**
 * Planilha "Modelo de Retorno" de "Ag. Emissão de Nota Fiscal" — mesmo
 * formato/colunas do arquivo-modelo enviado pelo Rafael (aba com o
 * nome da data, DDMMAAAA), sempre Aprovados primeiro e Recusados
 * depois (pedido explícito). Montada com ExcelJS (pedido explícito,
 * 25/09/2026 — mesma biblioteca/padrão de lib/planilhaContraProposta.ts;
 * a "xlsx" antiga não grava estilo nenhum, só valores, e essa planilha
 * agora também precisa de cor). Gerada no navegador (monta o buffer e
 * baixa via Blob — mesma técnica já usada em PainelModeloRetorno.tsx pra
 * baixar de novo um registro do histórico) — não muda nada no banco, só
 * baixa o arquivo.
 *
 * Destaques (pedido explícito, 25/09/2026 — mesma linguagem visual da
 * Contra Proposta, reaproveitando as MESMAS cores — ver
 * lib/coresPlanilhaExcel.ts):
 *  - Coluna "Tipo de Retorno": funciona igual a "STATUS ORÇAMENTO" da
 *    Contra Proposta (coluna BQ) — fundo + texto verde em Aprovado,
 *    fundo + texto vermelho em Reprovado.
 *  - Colunas "Valor Peça 1".."Valor Peça 10"/"Valor Peça Add 1".."Add 5":
 *    vermelho (mesma cor/negrito da coluna "STATUS ORÇAMENTO" recusado)
 *    nas linhas Reprovado.
 *  - Coluna "Motivo Reprova": mesma regra da Contra Proposta pra
 *    preencher "MOTIVO REPROVA" (coluna BR) — só texto, sem cor, só
 *    preenchida quando Reprovado, vindo do mesmo campo motivo_reprova.
 *
 * A montagem da planilha em si (montarPlanilha/montarWorkbook) é
 * compartilhada com a regeração no servidor — ver
 * gerarBufferModeloRetorno abaixo, usada pelo histórico de "Modelo de
 * Retorno" (menu Operacional > Modelo de Retorno, migration 0049) pra
 * baixar de novo, dias depois, exatamente a mesma planilha, a partir só
 * do snapshot de dados que foi salvo na hora da emissão.
 */
import type ExcelJS from "exceljs";
import { type CamposValorVigente, calcularMaoDeObraVigente } from "@/lib/orcamentos";
import { pecasVigentes, type PecaPosicionada } from "@/lib/exportN3";
import {
  PREENCHIMENTO_APROVADO,
  PREENCHIMENTO_RECUSADO,
  FONTE_APROVADO,
  FONTE_RECUSADO,
} from "@/lib/coresPlanilhaExcel";

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

/** Tudo que uma emissão da planilha precisa — é exatamente isso que
 * fica gravado (coluna `dados`, jsonb) em cada registro do histórico
 * (ver migration 0049 e /api/operacional/modelo-retorno), pra dar pra
 * remontar o mesmo Excel depois, sem precisar guardar o arquivo. */
export type SnapshotModeloRetorno = {
  aprovados: ItemModeloRetorno[];
  recusados: ItemModeloRetorno[];
  solucoesPorPartNumber: Record<string, string>;
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

// índices (0-based) usados na hora de colorir — pedido explícito,
// 25/09/2026 (ver destaques no comentário do topo do arquivo).
const IDX_TIPO_RETORNO = CABECALHO.indexOf("Tipo de Retorno");
// as 15 colunas "Valor Peça 1".."Valor Peça 10" + "Valor Peça Add 1".."5"
// são contíguas no CABECALHO — só as de PEÇA (não MO, nem os totais de
// NF no final, que também começam com "Valor").
const IDX_VALOR_PECA_1 = CABECALHO.indexOf("Valor Peça 1");
const QTD_COLUNAS_VALOR_PECA = 15;

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

/** DDMMAAAA de hoje, no fuso de Brasília — usado como nome da aba e do
 * arquivo na hora da emissão (ver gerarExcelModeloRetorno). Ao remontar
 * depois (gerarBufferModeloRetorno), NÃO chama essa função de novo —
 * usa a data que ficou gravada no registro, pra manter a planilha
 * idêntica à que foi baixada na hora, mesmo consultando dias depois. */
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

// ExcelJS funciona igual no navegador e no Node — por isso a mesma
// montagem serve tanto pro download direto no cliente
// (gerarExcelModeloRetorno) quanto pra remontagem no servidor
// (gerarBufferModeloRetorno, chamada pela rota de download do
// histórico). Mesmo padrão de lib/planilhaContraProposta.ts.
async function montarWorkbook(
  aprovados: ItemModeloRetorno[],
  recusados: ItemModeloRetorno[],
  solucoesPorPartNumber: Record<string, string>,
  dataReferencia: string
): Promise<ExcelJS.Workbook> {
  // import dinâmico (pedido explícito de manter o code-splitting que a
  // "xlsx" antiga já tinha aqui) — o ExcelJS só entra no bundle do
  // navegador na hora que "Emitir planilha de retorno" é clicado, não
  // toda vez que a tela de Ag. Emissão de Nota Fiscal carrega.
  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  const planilha = workbook.addWorksheet(dataReferencia);

  planilha.columns = CABECALHO.map((titulo) => ({ header: titulo, width: 16 }));

  // Aplica o formato de moeda (R$) na coluna inteira (não afeta o texto
  // do cabeçalho, só a exibição de célula numérica) — mesmo princípio de
  // antes, só que agora é 1 linha por coluna em vez de célula a célula.
  for (const coluna of COLUNAS_MOEDA) {
    planilha.getColumn(coluna + 1).numFmt = FORMATO_MOEDA;
  }

  function preencherLinha(item: ItemModeloRetorno, tipo: "Aprovado" | "Reprovado") {
    const valores = linhaItem(item, tipo, solucoesPorPartNumber);
    const linhaExcel = planilha.addRow(valores);

    // "Tipo de Retorno" funciona igual a "STATUS ORÇAMENTO" da Contra
    // Proposta (pedido explícito) — mesmas cores de lá.
    const celulaTipo = linhaExcel.getCell(IDX_TIPO_RETORNO + 1);
    if (tipo === "Aprovado") {
      celulaTipo.fill = PREENCHIMENTO_APROVADO;
      celulaTipo.font = FONTE_APROVADO;
    } else {
      celulaTipo.fill = PREENCHIMENTO_RECUSADO;
      celulaTipo.font = FONTE_RECUSADO;

      // reprovado: valor das peças em vermelho (pedido explícito) — só
      // nas posições que realmente têm valor lançado.
      for (let i = 0; i < QTD_COLUNAS_VALOR_PECA; i++) {
        const celulaValor = linhaExcel.getCell(IDX_VALOR_PECA_1 + 1 + i);
        if (celulaValor.value !== null && celulaValor.value !== undefined && celulaValor.value !== "") {
          celulaValor.font = FONTE_RECUSADO;
        }
      }
    }
  }

  for (const item of aprovados) preencherLinha(item, "Aprovado");
  for (const item of recusados) preencherLinha(item, "Reprovado");

  return workbook;
}

/** Gera e baixa a planilha "Modelo de Retorno" — Aprovados sempre
 * primeiro, Recusados depois (pedido explícito). Não grava nada no
 * banco nem muda status — só o Excel (o registro no histórico, se
 * quiser, é feito à parte, ver PainelAgEmissaoNf.tsx). Devolve o nome
 * do arquivo e a data de referência usados, pra quem chamar registrar
 * essa emissão com o MESMO nome/data (ver /api/operacional/modelo-retorno).
 *
 * O download em si sai via Blob + link temporário (mesma técnica já
 * usada em PainelModeloRetorno.tsx pra baixar de novo um registro do
 * histórico) — a antiga "xlsx" tinha um XLSX.writeFile() pronto pra
 * isso, o ExcelJS não, por isso o passo a mais aqui. */
export async function gerarExcelModeloRetorno(
  aprovados: ItemModeloRetorno[],
  recusados: ItemModeloRetorno[],
  solucoesPorPartNumber: Record<string, string>
): Promise<{ nomeArquivo: string; dataReferencia: string }> {
  const dataReferencia = dataArquivoBrasilia();
  const workbook = await montarWorkbook(aprovados, recusados, solucoesPorPartNumber, dataReferencia);
  const nomeArquivo = `Modelo_de_Retorno_${dataReferencia}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { nomeArquivo, dataReferencia };
}

/** Remonta (sem baixar) a mesma planilha "Modelo de Retorno" a partir
 * de um snapshot já salvo — usada só pela rota de download do
 * histórico (server-side), pra devolver os bytes do .xlsx idêntico ao
 * que foi baixado na hora da emissão (mesma `dataReferencia` gravada
 * naquele registro, não a data de hoje). */
export async function gerarBufferModeloRetorno(
  aprovados: ItemModeloRetorno[],
  recusados: ItemModeloRetorno[],
  solucoesPorPartNumber: Record<string, string>,
  dataReferencia: string
): Promise<Buffer> {
  const workbook = await montarWorkbook(aprovados, recusados, solucoesPorPartNumber, dataReferencia);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
