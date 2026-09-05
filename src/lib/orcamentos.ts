/**
 * Regras da rotina de importação de Orçamentos (menu BASES > Orçamentos).
 * Mapeamento de colunas confirmado a partir do arquivo de exemplo
 * "Reparo J Macedo NF1894525 2408.xlsx".
 */

// reaproveita o mesmo grupo de cargos já usado na Base Peças
export { CARGOS_IMPORTACAO_BASE_PECAS as CARGOS_IMPORTACAO_ORCAMENTOS, podeImportarBasePecas as podeImportarOrcamentos } from "@/lib/pecas";
// mesmo cálculo usado no BID — reaproveitado aqui pra apurar o Imposto
// (ICMS) e a Venda de Peça sobre o valor JÁ com margem, com exatamente
// as mesmas regras de arredondamento do BID (não sobre o custo cru da
// Base Peças, e sempre arredondado, nunca "quebrado").
import { calcularCustoPecaAllied, type FaixaMarkup } from "@/lib/bid";

// colunas da planilha original (0-indexed)
export const COL_REPARADOR_TERCEIRO = 0; // A
export const COL_NF_REMESSA_ALLIED = 1; // B
export const COL_DATA_RESPOSTA_ORCAMENTO = 2; // C (vem vazio)
export const COL_OS_REPARADORA = 3; // D (vem vazio, definir depois)
export const COL_IMEI_REPARADORA = 4; // E (vem vazio)
export const COL_ATENDIMENTO = 5; // F
export const COL_OS_CARE_ALLIED = 6; // G
export const COL_TRADE_ALLIED = 7; // H — campo-chave do aparelho
export const COL_IMEI_ALLIED = 8; // I
export const COL_CLASSIFICACAO_ALLIED = 9; // J
export const COL_SKU = 10; // K
export const COL_DESCRICAO_COMPLETA = 11; // L
export const COL_MODELO_COMERCIAL = 12; // M
export const COL_DESCRICAO_DEFEITO_INICIO = 13; // N..W (10 colunas)
export const COL_PECA_DEFEITO_INICIO = 23; // X..AG (10 colunas)
export const COL_OBSERVACAO_TECNICA = 33; // AH
export const COL_PECA_INICIO = 34; // AI..AR (10 colunas)
export const COL_PECA_ADD_INICIO = 44; // AS..AW (5 colunas)
export const COL_CUSTO_PECA_INICIO = 49; // AX..BG (10 colunas)
export const COL_CUSTO_PECA_ADD_INICIO = 59; // BH..BL (5 colunas)
export const COL_VALOR_TOTAL_PECA = 64; // BM
export const COL_MAO_DE_OBRA = 65; // BN
export const COL_VALOR_TOTAL_REPARO = 66; // BO
export const COL_TIPO_ORCAMENTO = 67; // BP
export const COL_STATUS_ORCAMENTO = 68; // BQ
export const COL_MOTIVO_REPROVA = 69; // BR
export const COL_OBS = 70; // BS

export type LinhaOrcamentoImportada = {
  reparador_terceiro: string | null;
  nf_remessa_allied: string;
  os_care_allied: string | null;
  trade_allied: string;
  imei_allied: string | null;
  imei_reparadora: string | null;
  classificacao_allied: string | null;
  sku: string | null;
  descricao_completa: string | null;
  modelo_comercial: string | null;
  atendimento: string | null;

  descricao_defeito: (string | null)[]; // 10
  peca_defeito: (string | null)[]; // 10
  observacao_tecnica_reparadora: string | null;

  peca: (string | null)[]; // 10
  peca_add: (string | null)[]; // 5
  custo_peca: (number | null)[]; // 10
  custo_peca_add: (number | null)[]; // 5

  tipo_orcamento: string | null;
  status_orcamento: string | null;
  motivo_reprova: string | null;
  obs: string | null;
};

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** IMEI Reparadora = IMEI Allied sem o prefixo "REC" (ex: REC350168310042735 -> 350168310042735). */
export function deriveImeiReparadora(imeiAllied: string | null): string | null {
  if (!imeiAllied) return null;
  return imeiAllied.toUpperCase().startsWith("REC") ? imeiAllied.slice(3) : imeiAllied;
}

/** Lê uma linha bruta da planilha (array de células) e monta o objeto tipado. */
export function lerLinhaOrcamento(linha: unknown[]): LinhaOrcamentoImportada | null {
  const nfRemessa = textoOuNull(linha[COL_NF_REMESSA_ALLIED]);
  const tradeAllied = textoOuNull(linha[COL_TRADE_ALLIED]);
  if (!nfRemessa || !tradeAllied) return null;

  const descricaoDefeito = Array.from({ length: 10 }, (_, i) => textoOuNull(linha[COL_DESCRICAO_DEFEITO_INICIO + i]));
  const pecaDefeito = Array.from({ length: 10 }, (_, i) => textoOuNull(linha[COL_PECA_DEFEITO_INICIO + i]));
  const peca = Array.from({ length: 10 }, (_, i) => textoOuNull(linha[COL_PECA_INICIO + i]));
  const pecaAdd = Array.from({ length: 5 }, (_, i) => textoOuNull(linha[COL_PECA_ADD_INICIO + i]));
  const custoPeca = Array.from({ length: 10 }, (_, i) => numeroOuNull(linha[COL_CUSTO_PECA_INICIO + i]));
  const custoPecaAdd = Array.from({ length: 5 }, (_, i) => numeroOuNull(linha[COL_CUSTO_PECA_ADD_INICIO + i]));

  const imeiAllied = textoOuNull(linha[COL_IMEI_ALLIED]);

  return {
    reparador_terceiro: textoOuNull(linha[COL_REPARADOR_TERCEIRO]),
    nf_remessa_allied: nfRemessa,
    os_care_allied: textoOuNull(linha[COL_OS_CARE_ALLIED])?.replace(/,\s*$/, "") ?? null,
    trade_allied: tradeAllied,
    imei_allied: imeiAllied,
    imei_reparadora: deriveImeiReparadora(imeiAllied),
    classificacao_allied: textoOuNull(linha[COL_CLASSIFICACAO_ALLIED]),
    sku: textoOuNull(linha[COL_SKU]),
    descricao_completa: textoOuNull(linha[COL_DESCRICAO_COMPLETA]),
    modelo_comercial: textoOuNull(linha[COL_MODELO_COMERCIAL]),
    atendimento: textoOuNull(linha[COL_ATENDIMENTO]),
    descricao_defeito: descricaoDefeito,
    peca_defeito: pecaDefeito,
    observacao_tecnica_reparadora: textoOuNull(linha[COL_OBSERVACAO_TECNICA]),
    peca,
    peca_add: pecaAdd,
    custo_peca: custoPeca,
    custo_peca_add: custoPecaAdd,
    tipo_orcamento: textoOuNull(linha[COL_TIPO_ORCAMENTO]),
    status_orcamento: textoOuNull(linha[COL_STATUS_ORCAMENTO]),
    motivo_reprova: textoOuNull(linha[COL_MOTIVO_REPROVA]),
    obs: textoOuNull(linha[COL_OBS]),
  };
}

// fluxo do menu Operacional — ordem de exibição dos cards.
// "Validação de Orçamentos" foi inserida sem número entre as etapas 2 e
// 3, pra não precisar renumerar (nem migrar os orçamentos já gravados
// nas) etapas 3 a 8, que têm o número no próprio valor de
// status_operacional.
export const STATUS_OPERACIONAL = [
  { valor: "Ag. Abertura", slug: "ag-abertura", label: "Ag. Abertura" },
  { valor: "1 - Ag. Triagem", slug: "1-ag-triagem", label: "1 - Ag. Triagem" },
  { valor: "2 - Ag. Análise", slug: "2-ag-analise", label: "2 - Ag. Análise" },
  { valor: "Validação de Orçamentos", slug: "validacao-orcamentos", label: "Validação de Orçamentos" },
  { valor: "3 - Ag. Resposta de Orçamento", slug: "3-ag-resposta-orcamento", label: "3 - Ag. Resposta de Orçamento" },
  { valor: "4 - Ag. Resposta de Reorçamento", slug: "4-ag-resposta-reorcamento", label: "4 - Ag. Resposta de Reorçamento" },
  { valor: "5 - Ag. Peças", slug: "5-ag-pecas", label: "5 - Ag. Peças" },
  { valor: "6 - Ag. Reparo", slug: "6-ag-reparo", label: "6 - Ag. Reparo" },
  { valor: "7 - Reparo Finalizado", slug: "7-reparo-finalizado", label: "7 - Reparo Finalizado" },
  { valor: "8 - Orçamento Reprovado", slug: "8-orcamento-reprovado", label: "8 - Orçamento Reprovado" },
  { valor: "Produto Entregue", slug: "produto-entregue", label: "Produto Entregue" },
] as const;

export type StatusOperacional = (typeof STATUS_OPERACIONAL)[number]["valor"];

export function statusPorSlug(slug: string) {
  return STATUS_OPERACIONAL.find((s) => s.slug === slug) ?? null;
}

// valores usados na confirmação de análise (ver
// api/operacional/orcamentos/[id]/confirmar-analise) — buscados pelo
// slug, não por índice do array, pra não quebrar se a ordem mudar de novo.
export const STATUS_AG_ANALISE = STATUS_OPERACIONAL.find((s) => s.slug === "2-ag-analise")!.valor;
export const STATUS_VALIDACAO_ORCAMENTOS = STATUS_OPERACIONAL.find((s) => s.slug === "validacao-orcamentos")!.valor;

// status que contam como "pedido fechado" — qualquer orçamento em
// qualquer outro status conta como "em aberto" (usado, por exemplo, pra
// saber se uma peça pendente no BID é prioridade de cadastro porque
// algum pedido em andamento precisa dela).
export const STATUS_ORCAMENTO_FECHADOS = ["Produto Entregue", "8 - Orçamento Reprovado"] as const;

// quem pode confirmar "Análise realizada" em lote (seleção múltipla) em
// 2 - Ag. Análise — cadastro individual continua liberado pra qualquer
// um que acesse a tela, só o modo em massa é restrito.
export const CARGOS_AG_ANALISE_LOTE = ["Supervisor", "Gerente"] as const;

export function podeConfirmarAnaliseEmLote(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil) return false;
  if (perfil.is_master) return true;
  return (CARGOS_AG_ANALISE_LOTE as readonly string[]).includes(perfil.cargo);
}

/** Valida o formato da OS Reparadora: só números, 10 caracteres (ex: 4123456789). */
export function osReparadoraValida(valor: string): boolean {
  return /^[0-9]{10}$/.test(valor.trim());
}

export type ConfiguracaoMaoDeObra = {
  valor_sem_peca: number;
  valor_uma_peca: number;
  valor_mais_de_uma_peca: number;
};

/**
 * Calcula valor total de peça, mão de obra e valor total do reparo com
 * base nas peças/custos preenchidos e nos parâmetros configuráveis de
 * mão de obra (menu Configurações > Mão de obra).
 */
export function calcularValoresOrcamento(
  peca: (string | null)[],
  pecaAdd: (string | null)[],
  custoPeca: (number | null)[],
  custoPecaAdd: (number | null)[],
  config: ConfiguracaoMaoDeObra
) {
  const quantidadePecas = [...peca, ...pecaAdd].filter((p) => p && p.trim() !== "").length;
  const valorTotalPeca = [...custoPeca, ...custoPecaAdd].reduce((soma: number, v) => soma + (v ?? 0), 0);

  const maoDeObra =
    quantidadePecas === 0
      ? config.valor_sem_peca
      : quantidadePecas === 1
        ? config.valor_uma_peca
        : config.valor_mais_de_uma_peca;

  const valorTotalReparo = valorTotalPeca + maoDeObra;

  return { quantidadePecas, valorTotalPeca, maoDeObra, valorTotalReparo };
}

/**
 * Mão de obra usada especificamente na tela Validação de Orçamentos:
 * 0 ou 1 peça usam o mesmo valor (valor_uma_peca), mais de 1 peça usa
 * valor_mais_de_uma_peca. Reaproveita os valores configuráveis de
 * Configurações > Mão de obra, mas agrupa "sem peça" junto com "uma
 * peça" — diferente de calcularValoresOrcamento (usado na importação),
 * que trata as três faixas (0 / 1 / mais de 1) separadamente.
 */
export function calcularMaoDeObraValidacao(
  quantidadePecas: number,
  config: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca">
): number {
  return quantidadePecas > 1 ? config.valor_mais_de_uma_peca : config.valor_uma_peca;
}

// ---- Validação de Orçamentos (por lote / NF Remessa) ----

export type PecaDetalheValidacao = {
  /** "1".."10" pra peça normal, "Extra 1".."Extra 5" pra peça adicional. */
  posicao: string;
  codigo: string;
  /** valor mais recente da Base Peças (pecas_vigentes) pra esse código —
   * null quando o código ainda não tem nenhuma compra importada. */
  custo: number | null;
  /** custo já com a margem da faixa de markup do BID aplicada — base
   * usada pra apurar o imposto (2 casas decimais). Null quando não há
   * faixa configurada que cubra esse custo. */
  valorComMargem: number | null;
  /** ICMS% sobre o valorComMargem (não sobre o custo cru da Base Peças),
   * arredondado pra cima com 2 casas — igual ao BID. */
  imposto: number;
  /** Venda de Peça = valorComMargem + imposto, arredondado pra cima pro
   * inteiro mais próximo — exatamente a mesma regra do "Custo Peça
   * (Allied)" do BID, só que aqui representa o que vai ser cobrado do
   * cliente por essa peça. Null quando não há custo ou faixa aplicável. */
  vendaPeca: number | null;
};

export type CamposPecasOrcamento = {
  peca_1: string | null; peca_2: string | null; peca_3: string | null; peca_4: string | null; peca_5: string | null;
  peca_6: string | null; peca_7: string | null; peca_8: string | null; peca_9: string | null; peca_10: string | null;
  peca_add_1: string | null; peca_add_2: string | null; peca_add_3: string | null; peca_add_4: string | null; peca_add_5: string | null;
};

export type DetalheValidacaoOrcamento = {
  quantidadePecas: number;
  /** soma do custo cru de cada peça, direto da Base Peças. */
  custoTotalPecas: number;
  /** soma do ICMS de cada peça (já sobre o valor com margem). */
  impostoTotalPecas: number;
  /** Valor Venda de Peças: soma de (valorComMargem + imposto) de cada
   * peça — o que efetivamente vai ser cobrado pelas peças do reparo. */
  vendaTotalPecas: number;
  maoDeObra: number;
  /** Lucro Líquido da Peça: venda de peças − custo das peças − imposto —
   * só o bloco de peça, sem misturar mão de obra. Mesmo o Imposto já
   * estando embutido no valor de venda (venda de peça = custo x markup +
   * imposto), ele é dinheiro que passa pela empresa e vai pro governo —
   * não fica de lucro — por isso desconta de novo aqui: venda é a
   * receita bruta faturada, e o imposto é um repasse, não lucro. */
  lucroLiquidoPeca: number;
  /** lucroLiquidoPeca + mão de obra — o resultado combinado (peça + mão de
   * obra) do reparo inteiro. */
  lucroTotal: number;
  /** Margem sobre venda: lucroLiquidoPeca / venda de peças, em %. */
  percLucroPecas: number;
  /** lucroTotal / (venda de peças + mão de obra), em %. */
  percLucroTotal: number;
  /** true quando alguma peça lançada não tem custo na Base Peças —
   * dispara o destaque "Prioridade" (vermelho) na lista. */
  temPecaSemCusto: boolean;
  pecas: PecaDetalheValidacao[];
};

/**
 * Monta o detalhe de peças de um orçamento pra Validação de Orçamentos:
 * custo de cada peça vem SEMPRE do valor mais recente da Base Peças
 * (pecas_vigentes, por código) — não do custo_peca_N gravado no próprio
 * orçamento nem do custo_peca_allied já calculado do BID. Imposto e
 * Venda de Peça, porém, seguem EXATAMENTE a mesma conta e o mesmo
 * arredondamento do BID (calcularCustoPecaAllied): valorComMargem =
 * teto(custo x multiplicador da faixa, 2 casas); imposto = teto(ICMS%
 * sobre o valorComMargem, 2 casas); vendaPeca = teto(valorComMargem +
 * imposto, inteiro) — nunca ICMS% direto sobre o custo cru, e nunca sem
 * arredondar (evita a soma dos valores "quebrados" bater diferente do
 * total exibido).
 */
export function calcularDetalheValidacao(
  campos: CamposPecasOrcamento,
  custosPorCodigo: Map<string, number>,
  icmsPercentual: number,
  configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca">,
  faixasMarkup: FaixaMarkup[]
): DetalheValidacaoOrcamento {
  const posicoes = [
    ...Array.from({ length: 10 }, (_, i) => ({
      posicao: String(i + 1),
      codigo: campos[`peca_${i + 1}` as keyof CamposPecasOrcamento],
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      posicao: `Extra ${i + 1}`,
      codigo: campos[`peca_add_${i + 1}` as keyof CamposPecasOrcamento],
    })),
  ];

  const pecas: PecaDetalheValidacao[] = posicoes
    .filter((p) => p.codigo && p.codigo.trim())
    .map((p) => {
      const codigo = p.codigo!.trim();
      const custo = custosPorCodigo.get(codigo) ?? null;
      const resultado = custo != null ? calcularCustoPecaAllied(custo, faixasMarkup, icmsPercentual) : null;
      return {
        posicao: p.posicao,
        codigo,
        custo,
        valorComMargem: resultado?.valorComMargem ?? null,
        imposto: resultado?.valorImposto ?? 0,
        vendaPeca: resultado?.custoPecaAllied ?? null,
      };
    });

  const quantidadePecas = pecas.length;
  const custoTotalPecas = pecas.reduce((soma, p) => soma + (p.custo ?? 0), 0);
  const impostoTotalPecas = pecas.reduce((soma, p) => soma + p.imposto, 0);
  const vendaTotalPecas = pecas.reduce((soma, p) => soma + (p.vendaPeca ?? 0), 0);
  const maoDeObra = calcularMaoDeObraValidacao(quantidadePecas, configMaoDeObra);
  const temPecaSemCusto = pecas.some((p) => p.custo == null);

  // bloco só de peça (venda − custo − imposto), sem misturar mão de
  // obra — e o combinado (+ mão de obra) por cima dele.
  const lucroLiquidoPeca = vendaTotalPecas - custoTotalPecas - impostoTotalPecas;
  const lucroTotal = lucroLiquidoPeca + maoDeObra;
  const percLucroPecas = vendaTotalPecas > 0 ? (lucroLiquidoPeca / vendaTotalPecas) * 100 : 0;
  const baseLucroTotal = vendaTotalPecas + maoDeObra;
  const percLucroTotal = baseLucroTotal > 0 ? (lucroTotal / baseLucroTotal) * 100 : 0;

  return {
    quantidadePecas,
    custoTotalPecas,
    impostoTotalPecas,
    vendaTotalPecas,
    maoDeObra,
    lucroLiquidoPeca,
    lucroTotal,
    percLucroPecas,
    percLucroTotal,
    temPecaSemCusto,
    pecas,
  };
}
