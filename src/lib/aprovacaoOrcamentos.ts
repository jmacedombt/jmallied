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
 *
 * Pedido explícito (depois desse arquivo de exemplo): quando a coluna BQ
 * vier "Contra Proposta"/variações, a coluna BS traz o valor total
 * (peças + mão de obra já somados) que a Allied contra-propôs pra
 * aquele OS Reparadora — lido aqui e gravado só como referência (ver
 * migration 0059_contra_proposta_valor_recebido.sql e a rota
 * upload-aprovacao), sem mexer no ajuste peça a peça que a equipe já
 * fazia manualmente em Ag. Contra Proposta.
 */
import { osReparadoraValida, type ResultadoAprovacaoAllied } from "@/lib/orcamentos";

// colunas do arquivo de aprovação (0-indexed).
export const COL_APROVACAO_OS_REPARADORA = 3; // D — "OS Reparadora"
export const COL_APROVACAO_STATUS = 68; // BQ — "STATUS ORÇAMENTO"
export const COL_APROVACAO_CONTRA_PROPOSTA_VALOR = 70; // BS — valor da Contra Proposta (só quando BQ = "Contra Proposta")

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

// aceita tanto célula já numérica (comum quando o Excel formata a
// coluna como número) quanto texto no padrão BR ("1.234,56") — mesmo
// parser tolerante já usado nos pop-ups de ajuste manual do sistema.
function paraNumeroOuNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const texto = String(v).trim();
  if (!texto) return null;
  const limpo = texto.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
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
  /** valor total (peças + mão de obra) que a Allied contra-propôs
   * (coluna BS) — só lido quando resultado === "Contra Proposta"; null
   * nos outros casos, ou se a célula vier vazia/ilegível mesmo com
   * "Contra Proposta" marcado. */
  valorContraPropostaAllied: number | null;
};

/** Lê uma linha bruta (array de células) do arquivo de aprovação — null
 * quando a OS Reparadora não é válida (10 dígitos) ou o status não é
 * reconhecido. */
export function lerLinhaAprovacao(linha: unknown[]): LinhaAprovacaoImportada | null {
  const osReparadora = textoOuNull(linha[COL_APROVACAO_OS_REPARADORA]);
  if (!osReparadora || !osReparadoraValida(osReparadora)) return null;

  const resultado = normalizarResultadoAprovacao(linha[COL_APROVACAO_STATUS]);
  if (!resultado || resultado === "Aguardando") return null;

  const valorContraPropostaAllied =
    resultado === "Contra Proposta" ? paraNumeroOuNull(linha[COL_APROVACAO_CONTRA_PROPOSTA_VALOR]) : null;

  return { osReparadora, resultado, valorContraPropostaAllied };
}
