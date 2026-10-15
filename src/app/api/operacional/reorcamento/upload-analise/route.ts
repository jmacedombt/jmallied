import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  podeConfirmarAprovacaoOrcamento,
  STATUS_AG_RESPOSTA_REORCAMENTO,
  STATUS_AG_PECAS,
  STATUS_AG_CONTRA_PROPOSTA,
  STATUS_ORCAMENTO_REPROVADO,
  MOTIVO_REPROVA_PADRAO,
} from "@/lib/orcamentos";
import { lerLinhaAprovacao } from "@/lib/aprovacaoOrcamentos";

export const maxDuration = 60;
const TAMANHO_LOTE = 300;

type Resultado = "Aprovado" | "Contra Proposta" | "Reprovado";

export type ItemAnaliseReorcamento = {
  id: string;
  osReparadora: string;
  tradeAllied: string;
  resultado: Resultado;
};

export type ResumoAnaliseReorcamento = {
  linhasNoArquivo: number;
  linhasNaoReconhecidas: number;
  itens: ItemAnaliseReorcamento[];
  /** OS do arquivo que estão em 4 - Ag. Resposta de Reorçamento mas ainda
   * com a planilha Complementar pendente de envio — ignoradas. */
  pendentesDeEnvio: string[];
  /** OS do arquivo que não estão em 4 - Ag. Resposta de Reorçamento. */
  naoEncontradas: string[];
};

// "Upload Análise Allied" em "4 - Ag. Resposta de Reorçamento" (pedido
// explícito, 15/10/2026). Lê o mesmo layout do arquivo de aprovação da
// Allied já usado na etapa 3 (coluna D = OS Reparadora, coluna BQ =
// STATUS ORÇAMENTO, coluna BS = valor da contra proposta — ver
// lib/aprovacaoOrcamentos.ts) e movimenta cada aparelho que estiver
// AGUARDANDO APROVAÇÃO nessa etapa:
//   BQ = APROVADO                         → 5 - Ag. Peças (igual ao botão Aprovar)
//   BQ = CONTRA PROPOSTA / CONTRAPROPOSTA → Ag. Contra Proposta
//   BQ = REPROVADO                        → 8 - Orçamento Reprovado (motivo padrão)
// Aparelho com a planilha Complementar ainda "Pendente de envio" é
// ignorado (mesma trava do botão Aprovar).
//
// Duas fases com o MESMO arquivo (campo "confirmar" do formulário):
//   confirmar = "false" → só lê e devolve o resumo (pop-up de conferência)
//   confirmar = "true"  → lê de novo e movimenta de fato
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAprovacaoOrcamento(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para subir a análise da Allied." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  const confirmar = formData.get("confirmar") === "true";

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo .xlsx com a análise da Allied." }, { status: 400 });
  }

  let linhasBrutas: unknown[][];
  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
    const planilha = workbook.Sheets[workbook.SheetNames[0]];
    linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler esse arquivo. Confirme que é uma planilha .xlsx válida." },
      { status: 400 }
    );
  }

  const linhasDados = linhasBrutas.slice(1);

  // última ocorrência de cada OS Reparadora vence
  const resultadoPorOs = new Map<string, { resultado: Resultado; valorContraProposta: number | null }>();
  let linhasNaoReconhecidas = 0;
  for (const linha of linhasDados) {
    const lida = lerLinhaAprovacao(linha);
    if (!lida) {
      linhasNaoReconhecidas += 1;
      continue;
    }
    resultadoPorOs.set(lida.osReparadora, { resultado: lida.resultado, valorContraProposta: lida.valorContraPropostaAllied });
  }

  const osReparadoras = Array.from(resultadoPorOs.keys());
  if (osReparadoras.length === 0) {
    return NextResponse.json(
      {
        error:
          "Não encontrei nenhuma linha reconhecível nesse arquivo (OS Reparadora válida na coluna D + APROVADO / CONTRA PROPOSTA / REPROVADO na coluna BQ).",
      },
      { status: 400 }
    );
  }

  type Encontrado = { id: string; tradeAllied: string; pendente: boolean };
  const encontrados = new Map<string, Encontrado>();
  for (let i = 0; i < osReparadoras.length; i += TAMANHO_LOTE) {
    const lote = osReparadoras.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin
      .from("orcamentos")
      .select("id, os_reparadora, trade_allied, reorcamento_detalhe, reorcamento_enviado_em")
      .eq("status_operacional", STATUS_AG_RESPOSTA_REORCAMENTO)
      .in("os_reparadora", lote);
    for (const row of data ?? []) {
      if (!row.os_reparadora) continue;
      encontrados.set(row.os_reparadora, {
        id: row.id,
        tradeAllied: row.trade_allied,
        pendente: row.reorcamento_detalhe != null && !row.reorcamento_enviado_em,
      });
    }
  }

  const itens: ItemAnaliseReorcamento[] = [];
  const pendentesDeEnvio: string[] = [];
  const naoEncontradas: string[] = [];
  for (const [osReparadora, { resultado }] of resultadoPorOs.entries()) {
    const e = encontrados.get(osReparadora);
    if (!e) naoEncontradas.push(osReparadora);
    else if (e.pendente) pendentesDeEnvio.push(osReparadora);
    else itens.push({ id: e.id, osReparadora, tradeAllied: e.tradeAllied, resultado });
  }

  const resumo: ResumoAnaliseReorcamento = {
    linhasNoArquivo: linhasDados.length,
    linhasNaoReconhecidas,
    itens,
    pendentesDeEnvio,
    naoEncontradas,
  };

  if (!confirmar) {
    return NextResponse.json({ resumo });
  }

  // ---- movimentação de fato ----
  const agora = new Date().toISOString();
  const movidos = { Aprovado: 0, "Contra Proposta": 0, Reprovado: 0 };
  const falhas: string[] = [];

  for (const item of itens) {
    const valorContraProposta = resultadoPorOs.get(item.osReparadora)?.valorContraProposta ?? null;
    let atualizacao: Record<string, unknown>;
    if (item.resultado === "Aprovado") {
      // mesmo efeito do botão Aprovar (aprovar-reorcamento/route.ts)
      atualizacao = {
        status_operacional: STATUS_AG_PECAS,
        aprovado_reorcamento_em: agora,
        aprovado_reorcamento_por: user.id,
      };
    } else if (item.resultado === "Contra Proposta") {
      // volta pra Ag. Contra Proposta "sem decisão" — limpa uma decisão
      // antiga de contra proposta (se o aparelho já tinha passado por lá)
      // pra ele aparecer pendente de novo na tela. Guarda o valor que a
      // Allied contra-propôs (coluna BS), igual ao upload da etapa 3.
      atualizacao = {
        status_operacional: STATUS_AG_CONTRA_PROPOSTA,
        resultado_aprovacao_allied: "Contra Proposta",
        resultado_aprovacao_definido_em: agora,
        contra_proposta_valor_recebido_allied: valorContraProposta,
        // ajuste antigo (se já passou por contra proposta antes) não tinha
        // as peças ADD — limpa pra tela montar de novo a partir do
        // reorçamento (originais + ADD), ver PainelContraProposta.tsx.
        contra_proposta_pecas: null,
        contra_proposta_mao_de_obra: null,
        contra_proposta_ajustado: false,
        contra_proposta_decisao: null,
        contra_proposta_motivo_recusa: null,
        contra_proposta_decidido_por: null,
        contra_proposta_decidido_em: null,
      };
    } else {
      atualizacao = {
        status_operacional: STATUS_ORCAMENTO_REPROVADO,
        motivo_reprova: MOTIVO_REPROVA_PADRAO,
        reprovado_por: user.id,
        reprovado_em: agora,
      };
    }

    // só movimenta se AINDA estiver em 4 - Ag. Resposta de Reorçamento
    // (alguém pode ter mexido entre a conferência e o Confirmar)
    const { data, error } = await admin
      .from("orcamentos")
      .update(atualizacao)
      .eq("id", item.id)
      .eq("status_operacional", STATUS_AG_RESPOSTA_REORCAMENTO)
      .select("id");

    if (error || !data || data.length === 0) falhas.push(item.osReparadora);
    else movidos[item.resultado] += 1;
  }

  return NextResponse.json({
    ok: true,
    resumo,
    aprovados: movidos.Aprovado,
    contraProposta: movidos["Contra Proposta"],
    reprovados: movidos.Reprovado,
    falhas,
  });
}
