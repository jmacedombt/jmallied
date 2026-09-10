/**
 * Leitura do arquivo que a Allied manda de volta com o resultado da
 * aprovação de cada orçamento (Aprovado / Contra Proposta / Reprovado) —
 * sobe em "3 - Ag. Resposta de Orçamento" (botão "Upload (aprovação de
 * orçamentos)"), casando cada linha pela OS REPARADORA.
 *
 * Colunas confirmadas com o arquivo real da Allied ("ORÇAMENTO NF 1904347
 * 131 APARELHOS resultado de aprovação de orçamentos.xlsx"): coluna D =
 * "OS Reparadora", coluna BQ = "STATUS ORÇAMENTO". Nesse arquivo de
 * exemplo algumas linhas têm "IMEI NÃO AUTORIZADO" em vez de uma OS
 * Reparadora válida — são descartadas normalmente por `osReparadoraValida`.
 */
import { osReparadoraValida, type ResultadoAprovacaoAllied } from "@/lib/orcamentos";

// colunas do arquivo de aprovação (0-indexed).
export const COL_APROVACAO_OS_REPARADORA = 3; // D — "OS Reparadora"
export const COL_APROVACAO_STATUS = 68; // BQ — "STATUS ORÇAMENTO"

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Normaliza o texto do status vindo do arquivo (maiúscula/minúscula,
 * acento, espaço a mais) pro valor canônico usado no sistema — retorna
 * null quando não reconhece o texto (linha descartada, contada como "não
 * reconhecida" no resultado do upload).
 */
export function normalizarResultadoAprovacao(v: unknown): ResultadoAprovacaoAllied | null {
  const texto = String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .trim()
    .toUpperCase();

  if (["APROVADO", "APROVADA"].includes(texto)) return "Aprovado";
  if (["CONTRA PROPOSTA", "CONTRAPROPOSTA", "CONTRA-PROPOSTA"].includes(texto)) return "Contra Proposta";
  if (["REPROVADO", "REPROVADA", "RECUSADO", "RECUSADA"].includes(texto)) return "Reprovado";
  return null;
}

export type LinhaAprovacaoImportada = {
  osReparadora: string;
  resultado: Exclude<ResultadoAprovacaoAllied, "Aguardando">;
};

/** Lê uma linha bruta (array de células) do arquivo de aprovação — null
 * quando a OS Reparadora não é válida (10 dígitos) ou o status não é
 * reconhecido. */
export function lerLinhaAprovacao(linha: unknown[]): LinhaAprovacaoImportada | null {
  const osReparadora = textoOuNull(linha[COL_APROVACAO_OS_REPARADORA]);
  if (!osReparadora || !osReparadoraValida(osReparadora)) return null;

  const resultado = normalizarResultadoAprovacao(linha[COL_APROVACAO_STATUS]);
  if (!resultado || resultado === "Aguardando") return null;

  return { osReparadora, resultado };
}
