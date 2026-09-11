import { createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_RESPOSTA_REORCAMENTO, type DetalheValidacaoOrcamento } from "@/lib/orcamentos";
import { buscarPrecosBidPorPartNumber } from "@/lib/bid";
import { formatarDataBrasilia } from "@/lib/tempo";
import { type LinhaPlanilhaOrcamento } from "@/lib/email";

/**
 * "Enviar planilha Complementar" (4 - Ag. Resposta de Reorçamento) —
 * mesma lógica de contraProposta.ts (o que a pessoa vê no preview tem
 * que ser exatamente o que sai), mas com uma diferença importante:
 * junta TODOS os reorçamentos pendentes de envio de uma vez, não
 * importa o lote (NF Remessa) — pedido do Rafael, e é como o modelo
 * real que ele mandou já vem (mais de uma NF Remessa no mesmo arquivo).
 * Só entram aqui os que chegaram em "4" pelo Reorçamento do técnico
 * (reorcamento_detalhe preenchido) — os que vieram por Contra Proposta
 * já foram enviados por aquele fluxo, não passam por aqui de novo.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const CAMPOS_DESCRICAO_DEFEITO = Array.from({ length: 10 }, (_, i) => `descricao_defeito_${i + 1}`);
const CAMPOS_PECA_DEFEITO = Array.from({ length: 10 }, (_, i) => `peca_defeito_${i + 1}`);
const COLUNAS_ESTATICAS = [
  "id",
  "reparador_terceiro",
  "nf_remessa_allied",
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
  "reorcamento_detalhe",
  ...CAMPOS_DESCRICAO_DEFEITO,
  ...CAMPOS_PECA_DEFEITO,
].join(", ");

type LinhaReorcamentoBruta = {
  id: string;
  reparador_terceiro: string | null;
  nf_remessa_allied: string;
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
  reorcamento_detalhe: DetalheValidacaoOrcamento | null;
  [chave: string]: unknown;
};

function listaCampo(a: LinhaReorcamentoBruta, prefixo: string): (string | null)[] {
  return Array.from({ length: 10 }, (_, i) => (a[`${prefixo}_${i + 1}`] as string | null) ?? null);
}

export type ItemReorcamentoConfirmavel = {
  id: string;
  nfRemessa: string;
  linha: LinhaPlanilhaOrcamento;
};

export type ResultadoPreparoReorcamento =
  | { ok: false; status: number; erro: string }
  | { ok: true; itens: ItemReorcamentoConfirmavel[] };

export async function prepararEnvioReorcamento(admin: AdminClient): Promise<ResultadoPreparoReorcamento> {
  const { data: aparelhosBrutos, error } = await admin
    .from("orcamentos")
    .select(COLUNAS_ESTATICAS)
    .eq("status_operacional", STATUS_AG_RESPOSTA_REORCAMENTO)
    .not("reorcamento_detalhe", "is", null)
    .is("reorcamento_enviado_em", null);

  if (error) {
    return { ok: false, status: 400, erro: error.message };
  }

  const lista = (aparelhosBrutos ?? []) as unknown as LinhaReorcamentoBruta[];

  if (lista.length === 0) {
    return { ok: false, status: 409, erro: "Não há reorçamentos pendentes de envio no momento." };
  }

  // Peça Solução (BID) de cada código usado (peças normais e
  // adicionais), pro arquivo sair no mesmo formato do envio original —
  // mesma tradução usada em validacaoEnvioAllied.ts / contraProposta.ts.
  const codigosUnicos = Array.from(
    new Set(lista.flatMap((a) => (a.reorcamento_detalhe?.pecas ?? []).map((p) => p.codigo)).filter(Boolean))
  );
  const precosBid = await buscarPrecosBidPorPartNumber(admin, codigosUnicos);
  function pecaSolucaoOuCodigo(codigo: string): string {
    return precosBid[codigo]?.peca_solucao ?? codigo;
  }

  const dataEnvioFormatada = formatarDataBrasilia(new Date().toISOString());

  const itens: ItemReorcamentoConfirmavel[] = lista.map((a) => {
    const detalhe = a.reorcamento_detalhe as DetalheValidacaoOrcamento;

    // detalhe.pecas mistura as peças originais (posição "1".."10",
    // congeladas na Validação) com as adicionais do Reorçamento
    // (posição "Extra 1".."Extra 5") — separa de volta nas duas listas
    // fixas do arquivo (PEÇA N / PEÇA ADD N).
    const peca: (string | null)[] = Array.from({ length: 10 }, () => null);
    const custoPeca: (number | null)[] = Array.from({ length: 10 }, () => null);
    const pecaAdd: (string | null)[] = Array.from({ length: 5 }, () => null);
    const custoPecaAdd: (number | null)[] = Array.from({ length: 5 }, () => null);

    for (const p of detalhe.pecas) {
      if (p.posicao.startsWith("Extra ")) {
        const indice = Number(p.posicao.replace("Extra ", "")) - 1;
        if (indice >= 0 && indice < 5) {
          pecaAdd[indice] = pecaSolucaoOuCodigo(p.codigo);
          custoPecaAdd[indice] = p.vendaPeca;
        }
      } else {
        const indice = Number(p.posicao) - 1;
        if (indice >= 0 && indice < 10) {
          peca[indice] = pecaSolucaoOuCodigo(p.codigo);
          custoPeca[indice] = p.vendaPeca;
        }
      }
    }

    const linha: LinhaPlanilhaOrcamento = {
      reparadorTerceiro: a.reparador_terceiro,
      nfRemessaAllied: a.nf_remessa_allied,
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
      pecaAdd,
      custoPeca,
      custoPecaAdd,
      valorTotalPeca: detalhe.vendaTotalPecas,
      maoDeObra: detalhe.maoDeObra,
      valorTotalReparo: detalhe.vendaTotalPecas + detalhe.maoDeObra,
      statusOrcamento: "COMPLEMENTAR",
      motivoReprova: null,
      obs: a.observacao_tecnica_reparadora,
    };

    return { id: a.id, nfRemessa: a.nf_remessa_allied, linha };
  });

  return { ok: true, itens };
}
