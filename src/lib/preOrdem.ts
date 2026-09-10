/**
 * Regras de leitura do arquivo de Pré-Ordem — sobe junto com a Base de
 * Orçamentos (menu BASES > Orçamentos) pra preencher o campo Pré-Ordem de
 * cada aparelho.
 *
 * A Pré-Ordem é gerada no sistema N3: dá o nome do lote, reconhece a nota
 * fiscal e depois vai em Operacional > Relatórios > Triagem > Pré-Ordem,
 * identifica o lote e baixa o arquivo — que sai do N3 na MESMA ORDEM do
 * arquivo de orçamentos. Não existe nenhuma chave em comum entre os dois
 * arquivos, então a vinculação é feita por sequência (linha 1 de um com a
 * linha 1 do outro, e assim até o fim) — por isso as validações abaixo
 * existem: pegam os dois arquivos fora de ordem/lote ANTES de gravar
 * qualquer coisa errada.
 */
import { textoOuNull } from "@/lib/orcamentos";

// colunas do arquivo de Pré-Ordem (0-indexed)
export const COL_PRE_ORDEM_CHECK_LOTE = 5; // F — precisa bater com a coluna B (NF Remessa Allied) do arquivo de orçamentos
export const COL_PRE_ORDEM_CHECK_SKU = 8; // I — precisa bater com a coluna K (SKU) do arquivo de orçamentos
export const COL_PRE_ORDEM_VALOR = 3; // D — número/código da pré-ordem, valor que é efetivamente gravado

export const EXPLICACAO_PRE_ORDEM =
  "A Pré-Ordem é gerada no sistema N3: dê o nome do lote, reconheça a nota fiscal e depois vá em " +
  "Operacional > Relatórios > Triagem > Pré-Ordem, identifique o lote e faça o download. Pra subir a Base de " +
  "Orçamentos agora é obrigatório enviar esse arquivo de Pré-Ordem junto — ele sai do N3 na mesma ordem do " +
  "arquivo de orçamentos, e é por essa ordem (não existe um código em comum entre os dois arquivos) que o " +
  "sistema atrela a pré-ordem de cada aparelho.";

export type DivergenciaPreOrdem = { linha: number; valorOrcamento: string | null; valorPreOrdem: string | null };

export type ResultadoValidacaoPreOrdem =
  | { ok: true }
  | { ok: false; motivo: "quantidade"; linhasOrcamento: number; linhasPreOrdem: number }
  | { ok: false; motivo: "lote"; divergencias: DivergenciaPreOrdem[]; totalDivergencias: number }
  | { ok: false; motivo: "sku"; divergencias: DivergenciaPreOrdem[]; totalDivergencias: number };

const MAX_DIVERGENCIAS_EXIBIDAS = 20;

/**
 * Valida o par de arquivos ANTES de qualquer filtro/dedup — compara linha
 * bruta a bruta (mesmo índice = mesma posição no arquivo), incluindo
 * linhas que a leitura normal descartaria como inválidas, porque o
 * objetivo aqui é confirmar que os dois arquivos são do mesmo lote, não
 * validar o conteúdo de cada aparelho.
 */
export function validarParPreOrdem(
  linhasOrcamento: unknown[][],
  linhasPreOrdem: unknown[][],
  colOrcamentoLote: number,
  colOrcamentoSku: number
): ResultadoValidacaoPreOrdem {
  if (linhasOrcamento.length !== linhasPreOrdem.length) {
    return {
      ok: false,
      motivo: "quantidade",
      linhasOrcamento: linhasOrcamento.length,
      linhasPreOrdem: linhasPreOrdem.length,
    };
  }

  const divergenciasLote: DivergenciaPreOrdem[] = [];
  const divergenciasSku: DivergenciaPreOrdem[] = [];

  for (let i = 0; i < linhasOrcamento.length; i++) {
    const lote1 = textoOuNull(linhasOrcamento[i][colOrcamentoLote]);
    const lote2 = textoOuNull(linhasPreOrdem[i][COL_PRE_ORDEM_CHECK_LOTE]);
    if (lote1 !== lote2) {
      divergenciasLote.push({ linha: i + 2, valorOrcamento: lote1, valorPreOrdem: lote2 });
    }

    const sku1 = textoOuNull(linhasOrcamento[i][colOrcamentoSku]);
    const sku2 = textoOuNull(linhasPreOrdem[i][COL_PRE_ORDEM_CHECK_SKU]);
    if (sku1 !== sku2) {
      divergenciasSku.push({ linha: i + 2, valorOrcamento: sku1, valorPreOrdem: sku2 });
    }
  }

  if (divergenciasLote.length > 0) {
    return {
      ok: false,
      motivo: "lote",
      divergencias: divergenciasLote.slice(0, MAX_DIVERGENCIAS_EXIBIDAS),
      totalDivergencias: divergenciasLote.length,
    };
  }
  if (divergenciasSku.length > 0) {
    return {
      ok: false,
      motivo: "sku",
      divergencias: divergenciasSku.slice(0, MAX_DIVERGENCIAS_EXIBIDAS),
      totalDivergencias: divergenciasSku.length,
    };
  }

  return { ok: true };
}

/** Extrai, na mesma ordem/posição do arquivo, o valor de Pré-Ordem (coluna D) de cada linha. */
export function extrairValoresPreOrdem(linhasPreOrdem: unknown[][]): (string | null)[] {
  return linhasPreOrdem.map((linha) => textoOuNull(linha[COL_PRE_ORDEM_VALOR]));
}
