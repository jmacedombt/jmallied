import { createAdminClient } from "@/lib/supabase/server";
import {
  STATUS_AG_CONTRA_PROPOSTA,
  calcularResumoContraProposta,
  type PecaContraProposta,
  type DetalheValidacaoOrcamento,
} from "@/lib/orcamentos";
import { buscarPrecosBidPorPartNumber } from "@/lib/bid";
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

  // Peça Solução (BID) de todo código usado nas 3 categorias, pro arquivo
  // sair no mesmo formato do envio original.
  const codigosUnicos = Array.from(
    new Set([
      ...aprovadosIniciais.flatMap((a) => (a.validacao_snapshot?.pecas ?? []).map((p) => p.codigo)),
      ...contraProposta.flatMap((a) =>
        a.contra_proposta_decisao === "Aprovado"
          ? (a.contra_proposta_pecas ?? []).map((p) => p.codigo)
          : (a.validacao_snapshot?.pecas ?? []).map((p) => p.codigo)
      ),
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

  return {
    ok: true,
    linhas: [...linhasAprovadosIniciais, ...linhasContraProposta],
    idsAprovados,
    idsReprovados,
    quantidadeAprovadosIniciais: linhasAprovadosIniciais.length,
    quantidadeContraPropostaAceita: idsAprovados.length,
    quantidadeReprovados: idsReprovados.length,
  };
}
