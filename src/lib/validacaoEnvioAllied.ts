import { createAdminClient } from "@/lib/supabase/server";
import {
  calcularDetalheValidacao,
  STATUS_ETAPAS_ANTERIORES_A_VALIDACAO,
  STATUS_ORCAMENTO_REPROVADO,
  STATUS_VALIDACAO_ORCAMENTOS,
  type CamposPecasOrcamento,
  type ConfiguracaoMaoDeObra,
  type DetalheValidacaoOrcamento,
} from "@/lib/orcamentos";
import { buscarPrecosBidPorPartNumber, type FaixaMarkup } from "@/lib/bid";
import { formatarDataBrasilia } from "@/lib/tempo";
import { type LinhaPlanilhaOrcamento } from "@/lib/email";

/**
 * Toda a lógica de "montar o envio de um lote pra Allied" (Validação de
 * Orçamentos > Confirmar Envio) — travas, cálculo e montagem das linhas
 * do arquivo — mora aqui, compartilhada entre:
 *   - a rota de PREVIEW (só gera o Excel pra conferência, não grava nada);
 *   - a rota de CONFIRMAR (faz tudo isso e além disso grava o avanço de
 *     etapa + o retrato congelado de cada orçamento, e dispara o e-mail).
 * Garante que o preview mostrado pra pessoa é EXATAMENTE o que vai ser
 * gravado/enviado se ela confirmar em seguida — mesmo cálculo, mesmo
 * código, uma função só.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

const CAMPOS_DESCRICAO_DEFEITO = Array.from({ length: 10 }, (_, i) => `descricao_defeito_${i + 1}`);
const CAMPOS_PECA_DEFEITO = Array.from({ length: 10 }, (_, i) => `peca_defeito_${i + 1}`);
const COLUNAS_ESTATICAS = [
  "reparador_terceiro",
  "os_reparadora",
  "imei_reparadora",
  "atendimento",
  "os_care_allied",
  "trade_allied",
  "imei_allied",
  "classificacao_allied",
  "sku",
  "descricao_completa",
  "modelo_comercial",
  "observacao_tecnica_reparadora",
  "motivo_reprova",
  ...CAMPOS_DESCRICAO_DEFEITO,
  ...CAMPOS_PECA_DEFEITO,
].join(", ");

const TAMANHO_LOTE_CODIGOS = 400;

type CamposEstaticosOrcamento = {
  reparador_terceiro: string | null;
  os_reparadora: string | null;
  imei_reparadora: string | null;
  atendimento: string | null;
  os_care_allied: string | null;
  trade_allied: string;
  imei_allied: string | null;
  classificacao_allied: string | null;
  sku: string | null;
  descricao_completa: string | null;
  modelo_comercial: string | null;
  observacao_tecnica_reparadora: string | null;
  motivo_reprova: string | null;
  descricao_defeito_1: string | null; descricao_defeito_2: string | null; descricao_defeito_3: string | null;
  descricao_defeito_4: string | null; descricao_defeito_5: string | null; descricao_defeito_6: string | null;
  descricao_defeito_7: string | null; descricao_defeito_8: string | null; descricao_defeito_9: string | null;
  descricao_defeito_10: string | null;
  peca_defeito_1: string | null; peca_defeito_2: string | null; peca_defeito_3: string | null; peca_defeito_4: string | null;
  peca_defeito_5: string | null; peca_defeito_6: string | null; peca_defeito_7: string | null; peca_defeito_8: string | null;
  peca_defeito_9: string | null; peca_defeito_10: string | null;
};

type LinhaOrcamentoLote = CamposPecasOrcamento &
  CamposEstaticosOrcamento & {
    id: string;
    validacao_confirmado_sem_peca: boolean;
  };

function listaDescricaoDefeito(a: CamposEstaticosOrcamento): (string | null)[] {
  return Array.from({ length: 10 }, (_, i) => a[`descricao_defeito_${i + 1}` as keyof CamposEstaticosOrcamento] as string | null);
}

function listaPecaDefeito(a: CamposEstaticosOrcamento): (string | null)[] {
  return Array.from({ length: 10 }, (_, i) => a[`peca_defeito_${i + 1}` as keyof CamposEstaticosOrcamento] as string | null);
}

export type ItemConfirmavel = {
  id: string;
  detalhe: DetalheValidacaoOrcamento;
  linha: LinhaPlanilhaOrcamento;
};

export type ResultadoPreparoEnvio =
  | { ok: false; status: number; erro: string; pecasDesatualizadas?: string[] }
  | { ok: true; itensConfirmaveis: ItemConfirmavel[]; linhasReprovados: LinhaPlanilhaOrcamento[] };

/**
 * Busca os aparelhos de um lote (NF Remessa), revalida as travas de
 * Validação de Orçamentos e monta, pra cada aparelho, o cálculo
 * congelado (detalhe) e a linha correspondente do arquivo de envio pra
 * Allied — sem gravar nada no banco. Travas revalidadas aqui (nunca
 * confia só na checagem que a tela já fez):
 *   0) nenhum aparelho do MESMO lote pode ainda estar parado numa etapa
 *      anterior à análise;
 *   1) nenhum aparelho do lote pode ter peça lançada sem custo na Base
 *      Peças;
 *   2) todo aparelho sem nenhuma peça lançada precisa já ter sido
 *      confirmado individualmente;
 *   3) o BID precisa refletir o mesmo valor que a Base Peças tem agora.
 */
export async function prepararEnvioLote(admin: AdminClient, nfRemessa: string): Promise<ResultadoPreparoEnvio> {
  const { data: aparelhos, error: erroBusca } = await admin
    .from("orcamentos")
    .select(`id, validacao_confirmado_sem_peca, ${COLUNAS_ESTATICAS}, ${COLUNAS_PECAS}`)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS)
    .eq("nf_remessa_allied", nfRemessa);

  if (erroBusca) {
    return { ok: false, status: 400, erro: erroBusca.message };
  }

  const lista = (aparelhos ?? []) as LinhaOrcamentoLote[];

  // aparelhos do MESMO lote já reprovados antes (etapa "8 - Orçamento
  // Reprovado") — entram no arquivo de envio junto com os que estão
  // avançando agora (mesmo lote, arquivo único), mas não são alterados
  // nem contam pras travas abaixo.
  const { data: reprovadosBrutos, error: erroReprovados } = await admin
    .from("orcamentos")
    .select(COLUNAS_ESTATICAS)
    .eq("status_operacional", STATUS_ORCAMENTO_REPROVADO)
    .eq("nf_remessa_allied", nfRemessa);

  if (erroReprovados) {
    return { ok: false, status: 400, erro: erroReprovados.message };
  }

  const reprovados = (reprovadosBrutos ?? []) as CamposEstaticosOrcamento[];

  if (lista.length === 0) {
    return { ok: false, status: 409, erro: "Não há aparelhos desse lote em Validação de Orçamentos no momento." };
  }

  // 0ª trava: mesmo lote (NF Remessa) não pode ter aparelho ainda parado
  // numa etapa anterior à análise.
  const { data: pendentesEtapaAnterior, error: erroPendencia } = await admin
    .from("orcamentos")
    .select("id")
    .eq("nf_remessa_allied", nfRemessa)
    .in("status_operacional", STATUS_ETAPAS_ANTERIORES_A_VALIDACAO as unknown as string[])
    .limit(1);

  if (erroPendencia) {
    return { ok: false, status: 400, erro: erroPendencia.message };
  }
  if ((pendentesEtapaAnterior ?? []).length > 0) {
    return {
      ok: false,
      status: 409,
      erro:
        "Esse lote ainda tem orçamento(s) pendente(s) em etapa anterior à análise (Ag. Abertura, 1 - Ag. Triagem ou 2 - Ag. Análise). Só é possível confirmar o envio depois que TODOS os aparelhos desse lote já tiverem sido analisados.",
    };
  }

  const codigosUnicos = Array.from(
    new Set(
      lista
        .flatMap((a) => [
          a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
          a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
        ])
        .map((c) => (typeof c === "string" ? c.trim() : c))
        .filter((c): c is string => !!c)
    )
  );

  const custosPorCodigo = new Map<string, number>();
  for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
    const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
    const { data } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
    for (const linha of data ?? []) custosPorCodigo.set(linha.codigo, Number(linha.valor_unitario));
  }

  let temPecaSemCusto = false;
  let temAparelhoNaoConfirmado = false;

  for (const a of lista) {
    const codigos = [
      a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
      a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
    ]
      .map((c) => (typeof c === "string" ? c.trim() : c))
      .filter((c): c is string => !!c);

    if (codigos.length === 0) {
      if (!a.validacao_confirmado_sem_peca) temAparelhoNaoConfirmado = true;
    } else if (codigos.some((c) => !custosPorCodigo.has(c))) {
      temPecaSemCusto = true;
    }
  }

  if (temPecaSemCusto) {
    return {
      ok: false,
      status: 409,
      erro: "Existem peças sem custo na Base Peças nesse lote (destaque em vermelho / Prioridade). Cadastre o valor delas antes de confirmar o envio.",
    };
  }
  if (temAparelhoNaoConfirmado) {
    return {
      ok: false,
      status: 409,
      erro: "Existem aparelhos sem nenhuma peça lançada (destaque em amarelo) que ainda não foram confirmados. Abra cada um e confirme antes de enviar o lote.",
    };
  }

  // 3ª trava: o BID (custo_peca_samsung persistido) precisa refletir o
  // mesmo valor que a Base Peças tem agora pra cada código usado nesse
  // lote. Ignora peça travada no BID (preço fixado na mão, de propósito).
  const pecasDesatualizadas = new Set<string>();
  for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
    const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
    const { data } = await admin
      .from("bid_pecas")
      .select("part_number, custo_peca_samsung, travado")
      .in("part_number", lote);
    for (const linha of (data ?? []) as { part_number: string; custo_peca_samsung: number | null; travado: boolean }[]) {
      if (linha.travado) continue;
      const valorVivo = custosPorCodigo.get(linha.part_number) ?? null;
      const diferente =
        (linha.custo_peca_samsung == null) !== (valorVivo == null) ||
        (linha.custo_peca_samsung != null && valorVivo != null && Math.abs(linha.custo_peca_samsung - valorVivo) > 0.001);
      if (diferente) pecasDesatualizadas.add(linha.part_number);
    }
  }

  if (pecasDesatualizadas.size > 0) {
    return {
      ok: false,
      status: 409,
      erro: "A Base Peças mudou desde o último Recalcular BID pra alguma peça desse lote — recalcule o BID (Bases > BID) antes de confirmar o envio, pra garantir que o valor informado ao cliente seja o mesmo que será cobrado.",
      pecasDesatualizadas: Array.from(pecasDesatualizadas),
    };
  }

  const [{ data: configImposto }, { data: configMaoObraBruta }, { data: faixasMarkupBrutas }] = await Promise.all([
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    admin.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
  ]);

  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
  const configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca"> = {
    valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 0),
    valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 0),
  };
  const faixasMarkup: FaixaMarkup[] = (
    (faixasMarkupBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  // data do envio (Confirmar Envio) — mesmo valor em toda linha do
  // arquivo, seja no preview ou na confirmação de verdade logo em
  // seguida (ambos rodam a poucos segundos de diferença).
  const dataEnvioFormatada = formatarDataBrasilia(new Date().toISOString());

  // Peça Solução (BID) de cada Part Number usado nesse lote — traduz o
  // código gravado em peca_1..10 pro nome que a Allied reconhece (ex:
  // "GH81-26447A" -> "BATERIA"). Cai pro próprio código quando o Part
  // Number tem custo cadastrado mas nenhuma Peça Solução registrada.
  const precosBid = await buscarPrecosBidPorPartNumber(admin, codigosUnicos);
  function pecaSolucaoOuCodigo(codigo: string): string {
    return precosBid[codigo]?.peca_solucao ?? codigo;
  }

  function montarPosicoesPeca(
    a: LinhaOrcamentoLote,
    detalhe: DetalheValidacaoOrcamento
  ): { peca: (string | null)[]; custoPeca: (number | null)[] } {
    const peca: (string | null)[] = [];
    const custoPeca: (number | null)[] = [];
    for (let n = 1; n <= 10; n++) {
      const codigo = (a[`peca_${n}` as keyof CamposPecasOrcamento] as string | null)?.trim() || null;
      if (!codigo) {
        peca.push(null);
        custoPeca.push(null);
        continue;
      }
      const detalhePeca = detalhe.pecas.find((p) => p.posicao === String(n));
      peca.push(pecaSolucaoOuCodigo(codigo));
      custoPeca.push(detalhePeca?.vendaPeca ?? null);
    }
    return { peca, custoPeca };
  }

  const itensConfirmaveis: ItemConfirmavel[] = lista.map((a) => {
    const detalhe = calcularDetalheValidacao(a, custosPorCodigo, icmsPercentual, configMaoDeObra, faixasMarkup);
    const { peca, custoPeca } = montarPosicoesPeca(a, detalhe);
    const linha: LinhaPlanilhaOrcamento = {
      reparadorTerceiro: a.reparador_terceiro,
      nfRemessaAllied: nfRemessa,
      dataRespostaOrcamento: dataEnvioFormatada,
      osReparadora: a.os_reparadora,
      imeiReparadora: a.imei_reparadora,
      atendimento: a.atendimento,
      osCareAllied: a.os_care_allied,
      tradeAllied: a.trade_allied,
      imeiAllied: a.imei_allied,
      classificacaoAllied: a.classificacao_allied,
      sku: a.sku,
      descricaoCompleta: a.descricao_completa,
      modeloComercial: a.modelo_comercial,
      descricaoDefeito: listaDescricaoDefeito(a),
      pecaDefeito: listaPecaDefeito(a),
      observacaoTecnicaReparadora: a.observacao_tecnica_reparadora,
      peca,
      pecaAdd: [null, null, null, null, null],
      custoPeca,
      custoPecaAdd: [null, null, null, null, null],
      valorTotalPeca: detalhe.vendaTotalPecas,
      maoDeObra: detalhe.maoDeObra,
      valorTotalReparo: detalhe.vendaTotalPecas + detalhe.maoDeObra,
      statusOrcamento: "AGUARDANDO",
      motivoReprova: null,
      obs: a.observacao_tecnica_reparadora,
    };
    return { id: a.id, detalhe, linha };
  });

  // aparelhos já reprovados antes, do mesmo lote — entram no arquivo com
  // os campos de peça/valor todos zerados (nunca chegaram a ser
  // precificados), igual ao modelo real usado como referência.
  const linhasReprovados: LinhaPlanilhaOrcamento[] = reprovados.map((a) => ({
    reparadorTerceiro: a.reparador_terceiro,
    nfRemessaAllied: nfRemessa,
    dataRespostaOrcamento: dataEnvioFormatada,
    osReparadora: a.os_reparadora,
    imeiReparadora: a.imei_reparadora,
    atendimento: a.atendimento,
    osCareAllied: a.os_care_allied,
    tradeAllied: a.trade_allied,
    imeiAllied: a.imei_allied,
    classificacaoAllied: a.classificacao_allied,
    sku: a.sku,
    descricaoCompleta: a.descricao_completa,
    modeloComercial: a.modelo_comercial,
    descricaoDefeito: listaDescricaoDefeito(a),
    pecaDefeito: listaPecaDefeito(a),
    observacaoTecnicaReparadora: a.observacao_tecnica_reparadora,
    peca: [null, null, null, null, null, null, null, null, null, null],
    pecaAdd: [null, null, null, null, null],
    custoPeca: [null, null, null, null, null, null, null, null, null, null],
    custoPecaAdd: [null, null, null, null, null],
    valorTotalPeca: 0,
    maoDeObra: 0,
    valorTotalReparo: 0,
    statusOrcamento: "RECUSADO",
    motivoReprova: a.motivo_reprova,
    obs: a.observacao_tecnica_reparadora,
  }));

  return { ok: true, itensConfirmaveis, linhasReprovados };
}
