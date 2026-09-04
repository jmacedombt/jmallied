/**
 * Regras do BID (menu BASES > BID e BASES > Pendências BID).
 *
 * Uma "peça" do BID é identificada por Modelo + Part Number. O custo
 * (Custo Peça Allied / valor com margem) é sempre calculado a partir do
 * custo mais recente da Base Peças (view pecas_vigentes) multiplicado
 * pela faixa de markup configurável em Configurações > Faixas de Markup.
 */

export { podeImportarBasePecas as podeImportarBid } from "@/lib/pecas";
import { STATUS_ORCAMENTO_FECHADOS } from "@/lib/orcamentos";

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

/** Direção da última alteração de valor: "+" se o novo é maior que o
 * anterior, "-" se é menor, null se não mudou. Ir de "sem valor" pra
 * "com valor" conta como alta ("+"); o inverso conta como queda ("-"). */
export function direcaoValor(anterior: number | null, novo: number | null): "+" | "-" | null {
  if (anterior == null && novo == null) return null;
  if (anterior == null) return "+";
  if (novo == null) return "-";
  if (novo === anterior) return null;
  return novo > anterior ? "+" : "-";
}

/** Percentual de lucro de uma edição manual do Custo Peça (Allied):
 * "lucro sobre o custo" = (valor editado − custo Base Peças) / custo
 * Base Peças × 100. Retorna null sem custo de referência (peça
 * pendente, ainda sem Part Number na Base Peças). */
export function percentualLucro(valorEditado: number, custoBasePecas: number | null): number | null {
  if (custoBasePecas == null || custoBasePecas === 0) return null;
  return ((valorEditado - custoBasePecas) / custoBasePecas) * 100;
}

const COLUNAS_PECA_ORCAMENTO = Array.from({ length: 10 }, (_, i) => `peca_${i + 1}`);

/** Busca o conjunto de Part Numbers referenciados em ao menos um
 * orçamento "em aberto" (qualquer status fora de STATUS_ORCAMENTO_FECHADOS)
 * — usado pra decidir prioridade de cadastro em Pendências BID e pro
 * alerta de notificações. Aceita tanto o client de servidor (cookies)
 * quanto o admin (service role); usa `any` porque os dois clientes têm
 * tipagens diferentes e nenhuma delas é reaproveitada aqui. */
export async function partNumbersReferenciadosEmOrcamentosAbertos(
  supabase: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Set<string>> {
  const LOTE = 1000;
  const listaFechados = STATUS_ORCAMENTO_FECHADOS.map((s) => `"${s}"`).join(",");
  const referenciados = new Set<string>();

  for (let inicio = 0; ; inicio += LOTE) {
    const { data, error } = await supabase
      .from("orcamentos")
      .select(COLUNAS_PECA_ORCAMENTO.join(", "))
      .not("status_operacional", "in", `(${listaFechados})`)
      .range(inicio, inicio + LOTE - 1);

    if (error || !data || data.length === 0) break;

    for (const linha of data as Record<string, string | null>[]) {
      for (const coluna of COLUNAS_PECA_ORCAMENTO) {
        const valor = linha[coluna];
        if (valor && valor.trim()) referenciados.add(valor.trim());
      }
    }

    if (data.length < LOTE) break;
  }

  return referenciados;
}

// ---- Busca ao vivo do BID por Part Number (usado em Ag. Análise) ----

export type InfoBidPeca = {
  id: string;
  modelo: string;
  part_number: string;
  peca_solucao: string | null;
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
  custo_peca_allied: number | null;
  valor_imposto: number | null;
  mao_de_obra: number | null;
  travado: boolean;
};

/** Busca, pra uma lista de Part Numbers, a peça do BID correspondente
 * (se existir) — usado em Ag. Análise pra trazer o Custo Peça (Allied)
 * "ao vivo" em vez do valor gravado no próprio orçamento. Um mesmo Part
 * Number pode aparecer em mais de um "modelo" no BID (peça compartilhada
 * entre aparelhos); nesse caso prioriza uma peça travada (preço definido
 * na mão) e, faltando isso, uma que já tenha valor calculado. Part
 * Number sem nenhuma linha no BID simplesmente não entra no resultado —
 * quem chama trata a ausência como "pendente de cadastro". */
export async function buscarPrecosBidPorPartNumber(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  partNumbers: (string | null)[]
): Promise<Record<string, InfoBidPeca>> {
  const unicos = Array.from(new Set(partNumbers.map((p) => p?.trim()).filter((p): p is string => !!p)));
  const resultado: Record<string, InfoBidPeca> = {};
  if (unicos.length === 0) return resultado;

  const LOTE = 400;
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE);
    const { data } = await supabase
      .from("bid_pecas")
      .select(
        "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, mao_de_obra, travado, bid_solucoes(peca_solucao, principal)"
      )
      .in("part_number", lote);

    for (const linha of (data ?? []) as any[]) {
      const solucoes = (linha.bid_solucoes ?? []) as { peca_solucao: string; principal: boolean }[];
      const principal = solucoes.find((s) => s.principal) ?? solucoes[0];
      const info: InfoBidPeca = {
        id: linha.id,
        modelo: linha.modelo,
        part_number: linha.part_number,
        peca_solucao: principal?.peca_solucao ?? null,
        custo_peca_samsung: linha.custo_peca_samsung,
        valor_com_margem: linha.valor_com_margem,
        custo_peca_allied: linha.custo_peca_allied,
        valor_imposto: linha.valor_imposto,
        mao_de_obra: linha.mao_de_obra,
        travado: linha.travado,
      };
      const existente = resultado[linha.part_number];
      const melhorQueExistente =
        !existente ||
        (info.travado && !existente.travado) ||
        (info.custo_peca_allied != null && existente.custo_peca_allied == null);
      if (melhorQueExistente) resultado[linha.part_number] = info;
    }
  }

  return resultado;
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
  valor_atualizado_em: string;
  valor_direcao: "+" | "-" | null;
  bid_solucoes: SolucaoBidConsulta[];
};
