/**
 * Regras da rotina de importação da Base Peças (menu BASES > Base Peças).
 */

// cargos que podem importar a base (Administrador = is_master, tratado à parte)
export const CARGOS_IMPORTACAO_BASE_PECAS = ["Estoque", "Supervisor", "Gerente"] as const;

export function podeImportarBasePecas(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil) return false;
  if (perfil.is_master) return true;
  return (CARGOS_IMPORTACAO_BASE_PECAS as readonly string[]).includes(perfil.cargo);
}

// colunas da planilha original (0-indexed), conforme mapeamento confirmado
export const COLUNA_DATA_COMPRA = 5; // F - Data NF
export const COLUNA_CODIGO = 7; // H - Peças enviadas
export const COLUNA_QUANTIDADE = 8; // I - Qtd
export const COLUNA_VALOR_TOTAL = 9; // J - Valor
export const COLUNA_DELIVERY = 13; // N - No. da Entrega
export const COLUNA_DESCRICAO = 16; // Q - Descrição Peça

export type LinhaPecaImportada = {
  codigo: string;
  descricao: string | null;
  data_compra: string; // ISO yyyy-mm-dd
  quantidade: number;
  valor_total: number;
  delivery: string;
};

/** Converte "25/08/2026" -> "2026-08-25". Retorna null se não for uma data válida. */
export function converterDataBr(valor: unknown): string | null {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  const texto = String(valor ?? "").trim();
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = Number(dia);
  const mo = Number(mes);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${ano}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
