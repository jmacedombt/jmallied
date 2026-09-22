import { createAdminClient } from "@/lib/supabase/server";
import {
  STATUS_AG_CONTRA_PROPOSTA,
  STATUS_ORCAMENTO_REPROVADO,
  calcularResumoContraProposta,
  calcularDetalheValidacao,
  type PecaContraProposta,
  type DetalheValidacaoOrcamento,
  type CamposPecasOrcamento,
  type ConfiguracaoMaoDeObra,
} from "@/lib/orcamentos";
import { buscarPrecosBidPorPartNumber, buscarOverridesMarkupPorLote, type FaixaMarkup } from "@/lib/bid";
import { formatarDataBrasilia } from "@/lib/tempo";
import { type LinhaPlanilhaOrcamento } from "@/lib/email";

/**
 * Monta a planilha final de "Enviar Contra Proposta" (Ag. Contra Proposta)
 * — substitui por completo o antigo fluxo por e-mail (prepararEnvioContraProposta
 * em lib/contraProposta.ts, que fica sem uso a partir daqui, mas não foi
 * apagado). Combina, pra um lote (NF Remessa), os 3 grupos que precisam
 * sair juntos no MESMO arquivo, no mesmo formato que a Allied usa pra
 * aprovação de orçamentos (ver CABECALHO_PLANILHA_ORCAMENTOS em
 * lib/email.ts):
 *
 *   1) "Aprovados inicialmente" — resultado_aprovacao_allied = "Aprovado"
 *      nesse lote (já saíram de Ag. Contra Proposta faz tempo, foram pra
 *      "5 - Ag. Peças" direto no Confirmar de "3 - Ag. Resposta de
 *      Orçamento") — entram SEM NENHUMA alteração, com os valores
 *      originais congelados no validacao_snapshot. Interpretação
 *      confirmada com o Rafael: "os que foram aprovados inicialmente" =
 *      esse grupo, não quem a Allied reprovou direto (esses já foram pra
 *      "8 - Orçamento Reprovado" com motivo fixo e são um fluxo
 *      encerrado, fora do escopo da Contra Proposta).
 *   2) "Contra Proposta aceita" — aparelhos ainda em Ag. Contra Proposta
 *      com contra_proposta_decisao = "Aprovado": usa contra_proposta_pecas
 *      /contra_proposta_mao_de_obra (congelados no momento da decisão),
 *      status "APROVADO".
 *   3) "Contra Proposta recusada" — contra_proposta_decisao = "Reprovado":
 *      mantém os valores ORIGINAIS (validacao_snapshot, igual ao grupo 1
 *      — nunca usa contra_proposta_pecas, que pode ter um valor
 *      proposto e recusado), status "RECUSADO", com o motivo digitado na
 *      coluna MOTIVO REPROVA.
 *   4) "Já reprovados" (pedido explícito) — aparelhos do MESMO lote que já
 *      estavam em "8 - Orçamento Reprovado" ANTES dessa geração (Allied
 *      reprovou direto na resposta de orçamento, ou reprovação manual em
 *      qualquer etapa) — entram no FINAL da planilha, com o motivo que já
 *      estava gravado (motivo_reprova). Usa validacao_snapshot quando
 *      existir; se o aparelho foi reprovado ANTES de chegar em Validação
 *      de Orçamentos (nunca teve preço apurado, nunca ganhou snapshot),
 *      recalcula ao vivo com os parâmetros atuais (mesmo fallback já
 *      usado em prepararEnvioLote/validacaoEnvioAllied.ts).
 */

type AdminClient = ReturnType<typeof createAdminClient>;

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
  ...CAMPOS_DESCRICAO_DEFEITO,
  ...CAMPOS_PECA_DEFEITO,
].join(", ");

type CamposEstaticos = {
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
  [chave: string]: unknown;
};

type LinhaAprovadoInicial = CamposEstaticos & {
  id: string;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

type LinhaContraProposta = CamposEstaticos & {
  id: string;
  contra_proposta_decisao: "Aprovado" | "Reprovado" | null;
  contra_proposta_motivo_recusa: string | null;
  contra_proposta_pecas: PecaContraProposta[] | null;
  contra_proposta_mao_de_obra: number | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

const COLUNAS_PECAS_RAW =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

type LinhaJaReprovada = CamposEstaticos &
  CamposPecasOrcamento & {
    id: string;
    validacao_snapshot: DetalheValidacaoOrcamento | null;
    motivo_reprova: string | null;
  };

function listaCampo(a: CamposEstaticos, prefixo: string): (string | null)[] {
  return Array.from({ length: 10 }, (_, i) => (a[`${prefixo}_${i + 1}`] as string | null) ?? null);
}

/** Monta as 10 posições de peça/valor a partir do snapshot congelado de
 * Validação (detalhe.pecas) — usado tanto pros "aprovados inicialmente"
 * quanto pra "Contra Proposta recusada" (ambos mantêm o valor ORIGINAL
 * enviado, nunca o que foi proposto/ajustado depois). Ignora posições
 * "Extra N" (peça adicional de Reorçamento) — a Contra Proposta nunca
 * mexe nessas, igual ao fluxo antigo (prepararEnvioContraProposta). */
function montarPosicoesOriginais(
  detalhe: DetalheValidacaoOrcamento | null,
  pecaSolucaoOuCodigo: (codigo: string) => string
): { peca: (string | null)[]; custoPeca: (number | null)[] } {
  const peca: (string | null)[] = Array.from({ length: 10 }, () => null);
  const custoPeca: (number | null)[] = Array.from({ length: 10 }, () => null);
  for (const p of detalhe?.pecas ?? []) {
    const indice = Number(p.posicao) - 1;
    if (Number.isInteger(indice) && indice >= 0 && indice < 10) {
      peca[indice] = pecaSolucaoOuCodigo(p.codigo);
      custoPeca[indice] = p.vendaPeca;
    }
  }
  return { peca, custoPeca };
}

/** Mesma ideia, a partir de contra_proposta_pecas (valor ACEITO/novo) —
 * usado só pra "Contra Proposta aceita". */
function montarPosicoesAceitas(
  pecas: PecaContraProposta[],
  pecaSolucaoOuCodigo: (codigo: string) => string
): { peca: (string | null)[]; custoPeca: (number | null)[] } {
  const peca: (string | null)[] = Array.from({ length: 10 }, () => null);
  const custoPeca: (number | null)[] = Array.from({ length: 10 }, () => null);
  for (const p of pecas) {
    const indice = Number(p.posicao) - 1;
    if (Number.isInteger(indice) && indice >= 0 && indice < 10) {
      peca[indice] = pecaSolucaoOuCodigo(p.codigo);
      custoPeca[indice] = p.vendaNova;
    }
  }
  return { peca, custoPeca };
}

export type ResultadoPreparoGeracaoContraProposta =
  | { ok: false; status: number; erro: string }
  | {
      ok: true;
      linhas: LinhaPlanilhaOrcamento[];
      idsAprovados: string[]; // Contra Proposta aceita -> vão pra "5 - Ag. Peças"
      idsReprovados: { id: string; motivo: string }[]; // Contra Proposta recusada -> vão pra "8 - Orçamento Reprovado"
      quantidadeAprovadosIniciais: number;
      quantidadeContraPropostaAceita: number;
      quantidadeReprovados: number;
      quantidadeJaReprovados: number;
    };

export async function prepararGeracaoContraProposta(
  admin: AdminClient,
  nfRemessa: string
): Promise<ResultadoPreparoGeracaoContraProposta> {
  const { data: contraPropostaBruta, error: erroContraProposta } = await admin
    .from("orcamentos")
    .select(
      `id, contra_proposta_decisao, contra_proposta_motivo_recusa, contra_proposta_pecas, contra_proposta_mao_de_obra, validacao_snapshot, ${COLUNAS_ESTATICAS}`
    )
    .eq("status_operacional", STATUS_AG_CONTRA_PROPOSTA)
    .eq("nf_remessa_allied", nfRemessa);

  if (erroContraProposta) {
    return { ok: false, status: 400, erro: erroContraProposta.message };
  }

  const contraProposta = (contraPropostaBruta ?? []) as unknown as LinhaContraProposta[];

  if (contraProposta.length === 0) {
    return { ok: false, status: 409, erro: "Não há aparelhos desse lote em Ag. Contra Proposta no momento." };
  }

  const naoDecididos = contraProposta.filter((a) => a.contra_proposta_decisao == null);
  if (naoDecididos.length > 0) {
    return {
      ok: false,
      status: 409,
      erro: `Ainda existem ${naoDecididos.length} aparelho(s) desse lote sem decisão (Aprovado/Reprovado). Decida cada um antes de enviar.`,
    };
  }

  const reprovadosSemMotivo = contraProposta.filter(
    (a) => a.contra_proposta_decisao === "Reprovado" && !a.contra_proposta_motivo_recusa?.trim()
  );
  if (reprovadosSemMotivo.length > 0) {
    return {
      ok: false,
      status: 409,
      erro: `Existem ${reprovadosSemMotivo.length} aparelho(s) reprovado(s) sem o motivo da recusa registrado.`,
    };
  }

  const { data: aprovadosIniciaisBrutos, error: erroAprovadosIniciais } = await admin
    .from("orcamentos")
    .select(`id, validacao_snapshot, ${COLUNAS_ESTATICAS}`)
    .eq("nf_remessa_allied", nfRemessa)
    .eq("resultado_aprovacao_allied", "Aprovado");

  if (erroAprovadosIniciais) {
    return { ok: false, status: 400, erro: erroAprovadosIniciais.message };
  }

  const aprovadosIniciais = (aprovadosIniciaisBrutos ?? []) as unknown as LinhaAprovadoInicial[];

  // 4) "Já reprovados" (pedido explícito) — aparelhos do MESMO lote já em
  // "8 - Orçamento Reprovado" antes dessa geração, vão no FINAL da
  // planilha (ver comentário no topo do arquivo).
  const { data: jaReprovadosBrutos, error: erroJaReprovados } = await admin
    .from("orcamentos")
    .select(`id, motivo_reprova, validacao_snapshot, ${COLUNAS_PECAS_RAW}, ${COLUNAS_ESTATICAS}`)
    .eq("status_operacional", STATUS_ORCAMENTO_REPROVADO)
    .eq("nf_remessa_allied", nfRemessa);

  if (erroJaReprovados) {
    return { ok: false, status: 400, erro: erroJaReprovados.message };
  }

  const jaReprovados = (jaReprovadosBrutos ?? []) as unknown as LinhaJaReprovada[];

  // Nem todo "já reprovado" tem validacao_snapshot — só ganha esse
  // congelamento quem foi reprovado exatamente estando em Validação de
  // Orçamentos (ver comentário em [id]/reprovar/route.ts); reprovação
  // ANTES disso nunca teve preço apurado. Pra esses casos, recalcula ao
  // vivo com os parâmetros atuais (mesmo fallback de prepararEnvioLote em
  // validacaoEnvioAllied.ts) — só busca configuração/custo se realmente
  // precisar.
  const detalheJaReprovadoPorId = new Map<string, DetalheValidacaoOrcamento | null>();
  const semSnapshot = jaReprovados.filter((a) => !a.validacao_snapshot);
  if (semSnapshot.length > 0) {
    const codigosSemSnapshot = Array.from(
      new Set(
        semSnapshot.flatMap((a) =>
          [
            a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
            a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
          ]
            .map((c) => (typeof c === "string" ? c.trim() : c))
            .filter((c): c is string => !!c)
        )
      )
    );
    const custosPorCodigo = new Map<string, number>();
    if (codigosSemSnapshot.length > 0) {
      const { data: custosBrutos } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", codigosSemSnapshot);
      for (const linha of (custosBrutos ?? []) as { codigo: string; valor_unitario: number }[]) {
        custosPorCodigo.set(linha.codigo, Number(linha.valor_unitario));
      }
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
    const faixasMarkupGlobal: FaixaMarkup[] = (
      (faixasMarkupBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
    ).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));
    const overridesDoLote = await buscarOverridesMarkupPorLote(admin, [nfRemessa]);
    const faixasMarkup: FaixaMarkup[] = overridesDoLote[nfRemessa] ?? faixasMarkupGlobal;

    for (const a of semSnapshot) {
      const detalhe = calcularDetalheValidacao(a as CamposPecasOrcamento, custosPorCodigo, icmsPercentual, configMaoDeObra, faixasMarkup);
      detalheJaReprovadoPorId.set(a.id, detalhe);
    }
  }
  for (const a of jaReprovados) {
    if (!detalheJaReprovadoPorId.has(a.id)) detalheJaReprovadoPorId.set(a.id, a.validacao_snapshot);
  }

  // Peça Solução (BID) de todo código usado nas 4 categorias, pro arquivo
  // sair no mesmo formato do envio original.
  const codigosUnicos = Array.from(
    new Set([
      ...aprovadosIniciais.flatMap((a) => (a.validacao_snapshot?.pecas ?? []).map((p) => p.codigo)),
      ...contraProposta.flatMap((a) =>
        a.contra_proposta_decisao === "Aprovado"
          ? (a.contra_proposta_pecas ?? []).map((p) => p.codigo)
          : (a.validacao_snapshot?.pecas ?? []).map((p) => p.codigo)
      ),
      ...jaReprovados.flatMap((a) => (detalheJaReprovadoPorId.get(a.id)?.pecas ?? []).map((p) => p.codigo)),
    ])
  );
  const precosBid = await buscarPrecosBidPorPartNumber(admin, codigosUnicos);
  function pecaSolucaoOuCodigo(codigo: string): string {
    return precosBid[codigo]?.peca_solucao ?? codigo;
  }

  const dataEnvioFormatada = formatarDataBrasilia(new Date().toISOString());

  function linhaBase(a: CamposEstaticos): Omit<
    LinhaPlanilhaOrcamento,
    "peca" | "custoPeca" | "valorTotalPeca" | "maoDeObra" | "valorTotalReparo" | "statusOrcamento" | "motivoReprova"
  > {
    return {
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
      descricaoDefeito: listaCampo(a, "descricao_defeito"),
      pecaDefeito: listaCampo(a, "peca_defeito"),
      observacaoTecnicaReparadora: a.observacao_tecnica_reparadora,
      pecaAdd: [null, null, null, null, null],
      custoPecaAdd: [null, null, null, null, null],
      obs: a.observacao_tecnica_reparadora,
    };
  }

  const linhasAprovadosIniciais: LinhaPlanilhaOrcamento[] = aprovadosIniciais.map((a) => {
    const detalhe = a.validacao_snapshot;
    const { peca, custoPeca } = montarPosicoesOriginais(detalhe, pecaSolucaoOuCodigo);
    const valorTotalPeca = detalhe?.vendaTotalPecas ?? 0;
    const maoDeObra = detalhe?.maoDeObra ?? 0;
    return {
      ...linhaBase(a),
      peca,
      custoPeca,
      valorTotalPeca,
      maoDeObra,
      valorTotalReparo: valorTotalPeca + maoDeObra,
      statusOrcamento: "APROVADO",
      motivoReprova: null,
    };
  });

  const idsAprovados: string[] = [];
  const idsReprovados: { id: string; motivo: string }[] = [];

  const linhasContraProposta: LinhaPlanilhaOrcamento[] = contraProposta.map((a) => {
    if (a.contra_proposta_decisao === "Aprovado") {
      idsAprovados.push(a.id);
      const pecas = a.contra_proposta_pecas ?? [];
      const maoDeObra = Number(a.contra_proposta_mao_de_obra ?? 0);
      const resumo = calcularResumoContraProposta(pecas, maoDeObra);
      const { peca, custoPeca } = montarPosicoesAceitas(pecas, pecaSolucaoOuCodigo);
      return {
        ...linhaBase(a),
        peca,
        custoPeca,
        valorTotalPeca: resumo.vendaTotalPecas,
        maoDeObra: resumo.maoDeObra,
        valorTotalReparo: resumo.vendaTotalPecas + resumo.maoDeObra,
        statusOrcamento: "APROVADO",
        motivoReprova: null,
      };
    }

    // Reprovado — mantém valores ORIGINAIS (nunca contra_proposta_pecas).
    const motivo = a.contra_proposta_motivo_recusa?.trim() || "";
    idsReprovados.push({ id: a.id, motivo });
    const detalhe = a.validacao_snapshot;
    const { peca, custoPeca } = montarPosicoesOriginais(detalhe, pecaSolucaoOuCodigo);
    const valorTotalPeca = detalhe?.vendaTotalPecas ?? 0;
    const maoDeObra = detalhe?.maoDeObra ?? 0;
    return {
      ...linhaBase(a),
      peca,
      custoPeca,
      valorTotalPeca,
      maoDeObra,
      valorTotalReparo: valorTotalPeca + maoDeObra,
      statusOrcamento: "RECUSADO",
      motivoReprova: motivo,
    };
  });

  const linhasJaReprovados: LinhaPlanilhaOrcamento[] = jaReprovados.map((a) => {
    const detalhe = detalheJaReprovadoPorId.get(a.id) ?? null;
    const { peca, custoPeca } = montarPosicoesOriginais(detalhe, pecaSolucaoOuCodigo);
    const valorTotalPeca = detalhe?.vendaTotalPecas ?? 0;
    const maoDeObra = detalhe?.maoDeObra ?? 0;
    return {
      ...linhaBase(a),
      peca,
      custoPeca,
      valorTotalPeca,
      maoDeObra,
      valorTotalReparo: valorTotalPeca + maoDeObra,
      statusOrcamento: "RECUSADO",
      motivoReprova: a.motivo_reprova,
    };
  });

  return {
    ok: true,
    // "Já reprovados" sempre no FINAL da planilha (pedido explícito).
    linhas: [...linhasAprovadosIniciais, ...linhasContraProposta, ...linhasJaReprovados],
    idsAprovados,
    idsReprovados,
    quantidadeAprovadosIniciais: linhasAprovadosIniciais.length,
    quantidadeContraPropostaAceita: idsAprovados.length,
    quantidadeReprovados: idsReprovados.length,
    quantidadeJaReprovados: linhasJaReprovados.length,
  };
}
