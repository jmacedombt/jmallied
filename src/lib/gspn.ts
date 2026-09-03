/**
 * Regras da importação da Base GSPN (menu BASES > Base GSPN).
 * Mapeamento de colunas confirmado a partir do arquivo "BASE GSPN.xlsx".
 */

// reaproveita o mesmo grupo de cargos já usado na Base Peças/Orçamentos
export {
  CARGOS_IMPORTACAO_BASE_PECAS as CARGOS_IMPORTACAO_GSPN,
  podeImportarBasePecas as podeImportarGspn,
} from "@/lib/pecas";

// colunas da planilha do GSPN (0-indexed)
export const COL_OS_REPARADORA = 1; // B - "SO Nro."
export const COL_ASC_JOB_NO = 2; // C - "ASC Job No."
export const COL_STATUS = 12; // M - "Status"
export const COL_MOTIVO = 14; // O - "Motivo"
// "Código da peça 01..10" — BJ, BS, CB, CK, CT, DC, DL, DU, ED, EM
export const COLS_PECA = [61, 70, 79, 88, 97, 106, 115, 124, 133, 142];

export type LinhaGspnImportada = {
  os_reparadora: string;
  asc_job_no: string | null;
  status: string | null;
  motivo: string | null;
  pecas: (string | null)[]; // 10
};

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

/** A OS Reparadora nessa planilha vem como número (ex: 4172898148) — normaliza
 * pra string de exatamente 10 dígitos, igual ao resto do sistema. Linha sem
 * OS Reparadora válida não dá pra casar com nada, então é descartada. */
function osReparadoraOuNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const texto = typeof v === "number" ? String(Math.round(v)) : String(v).trim();
  return /^\d{10}$/.test(texto) ? texto : null;
}

export function lerLinhaGspn(linha: unknown[]): LinhaGspnImportada | null {
  const osReparadora = osReparadoraOuNull(linha[COL_OS_REPARADORA]);
  if (!osReparadora) return null;

  return {
    os_reparadora: osReparadora,
    asc_job_no: textoOuNull(linha[COL_ASC_JOB_NO]),
    status: textoOuNull(linha[COL_STATUS]),
    motivo: textoOuNull(linha[COL_MOTIVO]),
    pecas: COLS_PECA.map((col) => textoOuNull(linha[col])),
  };
}
