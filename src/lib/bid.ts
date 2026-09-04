/**
 * Regras do BID (menu BASES > BID e BASES > Pendências BID).
 *
 * Uma "peça" do BID é identificada por Modelo + Part Number. O custo
 * (Custo Peça Allied / valor com margem) é sempre calculado a partir do
 * custo mais recente da Base Peças (view pecas_vigentes) multiplicado
 * pela faixa de markup configurável em Configurações > Faixas de Markup.
 */

export { podeImportarBasePecas as podeImportarBid } from "@/lib/pecas";

// colunas do arquivo BID padronizado pela Allied (0-indexed)
export const COL_BID_MODELO = 0; // A - Peças (modelo do aparelho)
export const COL_BID_PART_NUMBER = 1; // B - Part Number
export const COL_BID_PECA_SOLUCAO = 2; // C - Peça Solução (obrigatório)
// Coluna D (Custo Peça) e Coluna E (Mão de Obra) do arquivo são só
// referência do que já era praticado — não são usadas: o sistema
// recalcula os dois valores do zero.

export type LinhaBidImportada = {
  modelo: string;
  part_number: string;
  peca_solucao: string;
};

/** Primeiros 4 caracteres do Part Number, maiúsculo — usado pra agrupar
 * "famílias" de peças na hora de inferir a Mão de Obra por comparação. */
export function prefixoPartNumber(partNumber: string): string {
  return partNumber.trim().toUpperCase().slice(0, 4);
}

/** Arredonda pra cima com N casas decimais (padrão 2), evitando os
 * erros de ponto flutuante do JS puro (ex: 1.005 -> 1.01). */
export function arredondarParaCima(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.ceil(Math.round(valor * fator * 1000) / 1000) / fator;
}

export type FaixaMarkup = {
  valor_min: number;
  valor_max: number | null;
  multiplicador: number;
};

/** Acha a faixa de markup cujo intervalo [valor_min, valor_max] contém
 * o custo informado (valor_max nulo = "acima de"). Faixas devem vir
 * ordenadas por valor_min. */
export function faixaMarkupPara(custo: number, faixas: FaixaMarkup[]): FaixaMarkup | null {
  for (const faixa of faixas) {
    if (custo >= faixa.valor_min && (faixa.valor_max === null || custo <= faixa.valor_max)) {
      return faixa;
    }
  }
  return null;
}

/** Valor com margem = teto(custo da Base Peças x multiplicador da
 * faixa, 2 casas decimais) — é o valor ANTES do imposto. Retorna null
 * se nenhuma faixa cobrir o valor (configuração incompleta). */
export function calcularValorComMargem(custoSamsung: number, faixas: FaixaMarkup[]): number | null {
  const faixa = faixaMarkupPara(custoSamsung, faixas);
  if (!faixa) return null;
  return arredondarParaCima(custoSamsung * faixa.multiplicador, 2);
}

export type ResultadoCalculoBid = {
  /** Custo da Base Peças x multiplicador da faixa — sem imposto (2 casas decimais). */
  valorComMargem: number;
  /** Parcela de ICMS em R$, sobre o valor com margem (2 casas decimais). */
  valorImposto: number;
  /** valor_com_margem + valor_imposto, arredondado pra cima pro número
   * inteiro mais próximo — esse é o preço final usado no sistema. */
  custoPecaAllied: number;
};

/** Custo Peça (Allied) = teto(valor com margem + imposto ICMS sobre o
 * valor com margem, arredondado pro número inteiro — nunca fica
 * "quebrado", ex: 43,35 vira 44,00). Retorna null se nenhuma faixa
 * cobrir o custo informado (configuração incompleta). */
export function calcularCustoPecaAllied(
  custoSamsung: number,
  faixas: FaixaMarkup[],
  icmsPercentual: number
): ResultadoCalculoBid | null {
  const valorComMargem = calcularValorComMargem(custoSamsung, faixas);
  if (valorComMargem == null) return null;
  const valorImposto = arredondarParaCima(valorComMargem * (icmsPercentual / 100), 2);
  const custoPecaAllied = arredondarParaCima(valorComMargem + valorImposto, 0);
  return { valorComMargem, valorImposto, custoPecaAllied };
}

/** Percentual de lucro de uma edição manual do Custo Peça (Allied):
 * "lucro sobre o custo" = (valor editado − custo Base Peças) / custo
 * Base Peças × 100. Retorna null sem custo de referência (peça
 * pendente, ainda sem Part Number na Base Peças). */
export function percentualLucro(valorEditado: number, custoBasePecas: number | null): number | null {
  if (custoBasePecas == null || custoBasePecas === 0) return null;
  return ((valorEditado - custoBasePecas) / custoBasePecas) * 100;
}

// ---- Consulta BID (busca com dados completos carregados na tela) ----

export type SolucaoBidConsulta = { id: string; peca_solucao: string; principal: boolean };

export type PecaBidConsulta = {
  id: string;
  modelo: string;
  part_number: string;
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
  custo_peca_allied: number | null;
  valor_imposto: number | null;
  mao_de_obra: number | null;
  travado: boolean;
  travado_em: string | null;
  bid_solucoes: SolucaoBidConsulta[];
};
