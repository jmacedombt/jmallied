import type ExcelJS from "exceljs";

/**
 * Cores compartilhadas entre as planilhas montadas com ExcelJS (Contra
 * Proposta e, desde 25/09/2026, Modelo de Retorno) — pedido explícito:
 * "Tipo de Retorno" (Modelo de Retorno) tem que funcionar igual a
 * "STATUS ORÇAMENTO" (Contra Proposta), então as duas usam exatamente as
 * MESMAS constantes, em vez de duplicar os valores de ARGB.
 *
 * Isolado num arquivo próprio (sem nenhum outro import) de propósito:
 * lib/planilhaContraProposta.ts importa lib/email.ts (que usa
 * nodemailer, só roda no servidor) e lib/modeloRetorno.ts é usado tanto
 * no servidor quanto direto no navegador (PainelAgEmissaoNf.tsx) — se
 * modeloRetorno.ts importasse essas cores de planilhaContraProposta.ts,
 * o nodemailer (e os módulos nativos do Node que ele usa, tipo
 * "node:fs") ia junto no bundle do navegador e quebrava o build.
 */
export const PREENCHIMENTO_APROVADO: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDCFCE7" }, // verde claro
};
export const PREENCHIMENTO_RECUSADO: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFEE2E2" }, // vermelho claro
};
export const FONTE_APROVADO: Partial<ExcelJS.Font> = { color: { argb: "FF16A34A" }, bold: true };
export const FONTE_RECUSADO: Partial<ExcelJS.Font> = { color: { argb: "FFDC2626" }, bold: true };
