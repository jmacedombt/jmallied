import ExcelJS from "exceljs";
import { CABECALHO_PLANILHA_ORCAMENTOS, type LinhaPlanilhaOrcamento } from "@/lib/email";
import { PREENCHIMENTO_APROVADO, PREENCHIMENTO_RECUSADO, FONTE_APROVADO, FONTE_RECUSADO } from "@/lib/coresPlanilhaExcel";

/**
 * Monta a planilha de "Enviar Contra Proposta" — MESMO layout/ordem de
 * colunas de montarPlanilhaOrcamentos (lib/email.ts), mas usando ExcelJS
 * em vez da "xlsx" (a versão gratuita da "xlsx" não grava estilo nenhum
 * — cor de célula, negrito — só valores). Usada só aqui (pedido
 * explícito, restrito à planilha de Contra Proposta): "Confirmar Envio"
 * e "Enviar Reorçamento" continuam em montarPlanilhaOrcamentos, sem cor.
 *
 * Destaques (pedido explícito):
 *  - Coluna "STATUS ORÇAMENTO": fundo + texto verde em APROVADO, fundo +
 *    texto vermelho em RECUSADO.
 *  - Colunas "CUSTO PEÇA 1".."CUSTO PEÇA 10": vermelho e negrito na(s)
 *    posição(ões) marcada(s) em linha.pecaAlterada (só a Contra Proposta
 *    aceita usa esse campo — ver contraPropostaDecisao.ts).
 */

const IDX_CUSTO_PECA_1 = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("CUSTO PEÇA 1");
const IDX_STATUS_ORCAMENTO = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("STATUS ORÇAMENTO");
const IDX_VALOR_TOTAL_PECA = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("VALOR TOTAL PEÇA");
const IDX_MAO_DE_OBRA = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("MÃO DE OBRA");
const IDX_VALOR_TOTAL_REPARO = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("VALOR TOTAL DE REPARO");

// PREENCHIMENTO_APROVADO/RECUSADO e FONTE_APROVADO/RECUSADO agora vêm de
// lib/coresPlanilhaExcel.ts (pedido explícito, 25/09/2026: a planilha
// "Modelo de Retorno" reaproveita essas MESMAS cores pra colorir sua
// coluna "Tipo de Retorno" igual à "STATUS ORÇAMENTO" daqui — ver esse
// arquivo pra saber por que isso não podia continuar aqui dentro).
const FONTE_PECA_ALTERADA: Partial<ExcelJS.Font> = { color: { argb: "FFDC2626" }, bold: true };

function vazioOuTexto(v: string | null): string {
  return v ?? "";
}
function vazioOuNumero(v: number | null): number | "" {
  return v ?? "";
}

export async function montarPlanilhaContraProposta(linhas: LinhaPlanilhaOrcamento[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Orçamentos");

  planilha.columns = CABECALHO_PLANILHA_ORCAMENTOS.map((titulo) => ({ header: titulo, width: 16 }));

  for (const l of linhas) {
    const valores = [
      vazioOuTexto(l.reparadorTerceiro),
      l.nfRemessaAllied,
      l.dataRespostaOrcamento,
      vazioOuTexto(l.osReparadora),
      vazioOuTexto(l.imeiReparadora),
      vazioOuTexto(l.atendimento),
      vazioOuTexto(l.osCareAllied),
      l.tradeAllied,
      vazioOuTexto(l.imeiAllied),
      vazioOuTexto(l.classificacaoAllied),
      vazioOuTexto(l.sku),
      vazioOuTexto(l.descricaoCompleta),
      vazioOuTexto(l.modeloComercial),
      ...l.descricaoDefeito.map(vazioOuTexto),
      ...l.pecaDefeito.map(vazioOuTexto),
      vazioOuTexto(l.observacaoTecnicaReparadora),
      ...l.peca.map(vazioOuTexto),
      ...l.pecaAdd.map(vazioOuTexto),
      ...l.custoPeca.map(vazioOuNumero),
      ...l.custoPecaAdd.map(vazioOuNumero),
      l.valorTotalPeca,
      l.maoDeObra,
      l.valorTotalReparo,
      "", // TIPO ORÇAMENTO — sempre vazio
      l.statusOrcamento,
      vazioOuTexto(l.motivoReprova),
      vazioOuTexto(l.obs),
    ];

    const linhaExcel = planilha.addRow(valores);

    const statusCelula = linhaExcel.getCell(IDX_STATUS_ORCAMENTO + 1);
    if (l.statusOrcamento === "APROVADO") {
      statusCelula.fill = PREENCHIMENTO_APROVADO;
      statusCelula.font = FONTE_APROVADO;
    } else if (l.statusOrcamento === "RECUSADO") {
      statusCelula.fill = PREENCHIMENTO_RECUSADO;
      statusCelula.font = FONTE_RECUSADO;
    }

    if (l.pecaAlterada) {
      l.pecaAlterada.forEach((alterada, indice) => {
        if (!alterada) return;
        linhaExcel.getCell(IDX_CUSTO_PECA_1 + 1 + indice).font = FONTE_PECA_ALTERADA;
      });
    }
  }

  // linha de totais no final, igual ao modelo real da Allied — soma só
  // Valor Total Peça / Mão de Obra / Valor Total de Reparo, resto vazio.
  const linhaTotais = CABECALHO_PLANILHA_ORCAMENTOS.map(() => "" as string | number);
  linhaTotais[IDX_VALOR_TOTAL_PECA] = linhas.reduce((soma, l) => soma + l.valorTotalPeca, 0);
  linhaTotais[IDX_MAO_DE_OBRA] = linhas.reduce((soma, l) => soma + l.maoDeObra, 0);
  linhaTotais[IDX_VALOR_TOTAL_REPARO] = linhas.reduce((soma, l) => soma + l.valorTotalReparo, 0);
  planilha.addRow(linhaTotais);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
