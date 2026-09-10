import { createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_CONTRA_PROPOSTA, type PecaContraProposta, type ResumoContraProposta, calcularResumoContraProposta } from "@/lib/orcamentos";
import { buscarPrecosBidPorPartNumber } from "@/lib/bid";
import { formatarDataBrasilia } from "@/lib/tempo";
import { type LinhaPlanilhaOrcamento } from "@/lib/email";

/**
 * "Enviar Contra Proposta" (Ag. Contra Proposta) — equivalente ao
 * "Confirmar Envio" de Validação de Orçamentos (lib/validacaoEnvioAllied.ts),
 * só que bem mais simples: aqui não recalcula nada a partir da Base
 * Peças/BID — os valores já foram ajustados e congelados peça a peça,
 * um a um, no pop-up de Contra Proposta (contra_proposta_pecas +
 * contra_proposta_mao_de_obra). Compartilhado entre a rota de PREVIEW e
 * a de ENVIAR, mesmo motivo: o que a pessoa vê antes de enviar tem que
 * ser exatamente o que sai.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const CAMPOS_DESCRICAO_DEFEITO = Array.from({ length: 10 }, (_, i) => `descricao_defeito_${i + 1}`);
const CAMPOS_PECA_DEFEITO = Array.from({ length: 10 }, (_, i) => `peca_defeito_${i + 1}`);
const COLUNAS_ESTATICAS = [
  "id",
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
  "contra_proposta_pecas",
  "contra_proposta_mao_de_obra",
  "contra_proposta_ajustado",
  ...CAMPOS_DESCRICAO_DEFEITO,
  ...CAMPOS_PECA_DEFEITO,
].join(", ");

type LinhaContraPropostaBruta = {
  id: string;
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
  contra_proposta_pecas: PecaContraProposta[] | null;
  contra_proposta_mao_de_obra: number | null;
  contra_proposta_ajustado: boolean;
  [chave: string]: unknown;
};

function listaCampo(a: LinhaContraPropostaBruta, prefixo: string): (string | null)[] {
  return Array.from({ length: 10 }, (_, i) => (a[`${prefixo}_${i + 1}`] as string | null) ?? null);
}

export type ItemContraPropostaConfirmavel = {
  id: string;
  resumo: ResumoContraProposta;
  linha: LinhaPlanilhaOrcamento;
};

export type ResultadoPreparoContraProposta =
  | { ok: false; status: number; erro: string }
  | { ok: true; itens: ItemContraPropostaConfirmavel[] };

export async function prepararEnvioContraProposta(admin: AdminClient, nfRemessa: string): Promise<ResultadoPreparoContraProposta> {
  const { data: aparelhosBrutos, error } = await admin
    .from("orcamentos")
    .select(COLUNAS_ESTATICAS)
    .eq("status_operacional", STATUS_AG_CONTRA_PROPOSTA)
    .eq("nf_remessa_allied", nfRemessa);

  if (error) {
    return { ok: false, status: 400, erro: error.message };
  }

  const lista = (aparelhosBrutos ?? []) as unknown as LinhaContraPropostaBruta[];

  if (lista.length === 0) {
    return { ok: false, status: 409, erro: "Não há aparelhos desse lote em Ag. Contra Proposta no momento." };
  }

  const naoAjustados = lista.filter((a) => !a.contra_proposta_ajustado);
  if (naoAjustados.length > 0) {
    return {
      ok: false,
      status: 409,
      erro: `Ainda existem ${naoAjustados.length} aparelho(s) desse lote sem o ajuste de Contra Proposta confirmado. Abra cada um e confirme a alteração antes de enviar.`,
    };
  }

  // Peça Solução (BID) de cada código usado, pro arquivo sair no mesmo
  // formato do envio original — mesma tradução usada em
  // validacaoEnvioAllied.ts.
  const codigosUnicos = Array.from(
    new Set(lista.flatMap((a) => (a.contra_proposta_pecas ?? []).map((p) => p.codigo)).filter(Boolean))
  );
  const precosBid = await buscarPrecosBidPorPartNumber(admin, codigosUnicos);
  function pecaSolucaoOuCodigo(codigo: string): string {
    return precosBid[codigo]?.peca_solucao ?? codigo;
  }

  const dataEnvioFormatada = formatarDataBrasilia(new Date().toISOString());

  const itens: ItemContraPropostaConfirmavel[] = lista.map((a) => {
    const pecas = a.contra_proposta_pecas ?? [];
    const maoDeObra = Number(a.contra_proposta_mao_de_obra ?? 0);
    const resumo = calcularResumoContraProposta(pecas, maoDeObra);

    // 10 posições fixas, igual ao arquivo original — pecas guarda só as
    // que existem (não vazias), então preenche pela posição declarada.
    const peca: (string | null)[] = Array.from({ length: 10 }, () => null);
    const custoPeca: (number | null)[] = Array.from({ length: 10 }, () => null);
    for (const p of pecas) {
      const indice = Number(p.posicao) - 1;
      if (indice >= 0 && indice < 10) {
        peca[indice] = pecaSolucaoOuCodigo(p.codigo);
        custoPeca[indice] = p.vendaNova;
      }
    }

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
      descricaoDefeito: listaCampo(a, "descricao_defeito"),
      pecaDefeito: listaCampo(a, "peca_defeito"),
      observacaoTecnicaReparadora: a.observacao_tecnica_reparadora,
      peca,
      pecaAdd: [null, null, null, null, null],
      custoPeca,
      custoPecaAdd: [null, null, null, null, null],
      valorTotalPeca: resumo.vendaTotalPecas,
      maoDeObra: resumo.maoDeObra,
      valorTotalReparo: resumo.vendaTotalPecas + resumo.maoDeObra,
      statusOrcamento: "CONTRA PROPOSTA",
      motivoReprova: null,
      obs: a.observacao_tecnica_reparadora,
    };

    return { id: a.id, resumo, linha };
  });

  return { ok: true, itens };
}
