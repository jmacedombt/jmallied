import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { calcularCustoPecaAllied, direcaoValor, podeImportarBid, type FaixaMarkup } from "@/lib/bid";

export const maxDuration = 60;
const TAMANHO_LOTE = 400;

type PecaExistente = {
  id: string;
  modelo: string;
  part_number: string;
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
  custo_peca_allied: number | null;
  valor_imposto: number | null;
  valor_atualizado_em: string;
  valor_direcao: "+" | "-" | null;
  travado: boolean;
  valor_enviado_cliente: number | null;
};

function valoresDiferentes(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) > 0.001;
}

// Refaz o cálculo de custo_peca_samsung/valor_com_margem de todas as
// peças do BID a partir da Base Peças e das faixas de markup atuais —
// sem precisar reimportar o arquivo. Usado depois de uma Base Peças
// nova ser importada. Toda mudança de valor entra no histórico.
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

  if (!podeImportarBid(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para recalcular o BID." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  // só true quando o usuário já viu a lista de divergências (peças já
  // enviadas ao cliente cujo valor mudaria) e confirmou explicitamente
  // que quer mesmo aplicar — sem isso a rota nem chega a mexer em nada,
  // só devolve a lista pra tela mostrar.
  const confirmarDivergencias = body?.confirmarDivergencias === true;

  // busca TODAS as peças, paginando — sem isso o Supabase corta
  // silenciosamente em 1000 linhas por consulta (limite padrão do
  // PostgREST) e o restante da base nunca chega a ser reprocessado,
  // não importa quantas vezes "Recalcular" seja clicado.
  const LOTE_BUSCA = 1000;
  const pecas: PecaExistente[] = [];
  for (let inicio = 0; ; inicio += LOTE_BUSCA) {
    const { data, error } = (await admin
      .from("bid_pecas")
      .select(
        "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, valor_atualizado_em, valor_direcao, travado, valor_enviado_cliente"
      )
      .range(inicio, inicio + LOTE_BUSCA - 1)) as unknown as { data: PecaExistente[] | null; error: { message: string } | null };
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data || data.length === 0) break;
    pecas.push(...data);
    if (data.length < LOTE_BUSCA) break;
  }

  const [{ data: faixasBrutas }, { data: configImposto }] = await Promise.all([
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
  ]);

  if (pecas.length === 0) {
    return NextResponse.json({ pecasVerificadas: 0, pecasAlteradas: 0 });
  }

  const faixas: FaixaMarkup[] = (
    (faixasBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);

  const partNumbersUnicos = Array.from(new Set(pecas.map((p) => p.part_number)));
  const custosPorPartNumber = new Map<string, number>();
  for (let i = 0; i < partNumbersUnicos.length; i += TAMANHO_LOTE) {
    const lote = partNumbersUnicos.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
    for (const linha of data ?? []) custosPorPartNumber.set(linha.codigo, Number(linha.valor_unitario));
  }

  const atualizacoes: {
    id: string;
    modelo: string;
    part_number: string;
    custo_peca_samsung: number | null;
    valor_com_margem: number | null;
    custo_peca_allied: number | null;
    valor_imposto: number | null;
    valor_atualizado_em: string;
    valor_direcao: "+" | "-" | null;
  }[] = [];
  const historico: Record<string, unknown>[] = [];
  // peças já enviadas ao cliente (valor_enviado_cliente preenchido) cujo
  // valor final mudaria com esse recálculo — precisa de confirmação
  // explícita antes de aplicar qualquer coisa (nem essas, nem as outras).
  const divergencias: {
    bidPecaId: string;
    modelo: string;
    partNumber: string;
    valorEnviadoCliente: number | null;
    valorAtual: number | null;
    valorNovo: number | null;
  }[] = [];

  for (const peca of pecas) {
    // peça travada na Consulta BID: preço definido manualmente, não
    // mexe (nem gera entrada de histórico) até ser destravada
    if (peca.travado) continue;

    const custoSamsung = custosPorPartNumber.get(peca.part_number) ?? null;
    const resultado = custoSamsung != null ? calcularCustoPecaAllied(custoSamsung, faixas, icmsPercentual) : null;
    const valorComMargem = resultado?.valorComMargem ?? null;
    const valorImposto = resultado?.valorImposto ?? null;
    const custoPecaAllied = resultado?.custoPecaAllied ?? null;

    const mudou =
      valoresDiferentes(peca.custo_peca_samsung, custoSamsung) ||
      valoresDiferentes(peca.valor_com_margem, valorComMargem) ||
      valoresDiferentes(peca.custo_peca_allied, custoPecaAllied);

    if (!mudou) continue;

    // "última alteração" só muda quando o preço final (custo_peca_allied)
    // de fato muda — não a cada ajuste fino de custo_peca_samsung que não
    // chega a mexer no valor final por causa do arredondamento.
    const mudouValorFinal = valoresDiferentes(peca.custo_peca_allied, custoPecaAllied);
    const valorAtualizadoEm = mudouValorFinal ? new Date().toISOString() : peca.valor_atualizado_em;
    const valorDirecao = mudouValorFinal ? direcaoValor(peca.custo_peca_allied, custoPecaAllied) : peca.valor_direcao;

    // peça já enviada ao cliente e o valor final vai mudar de verdade:
    // é uma divergência do que já foi informado — junta na lista pra
    // confirmação em vez de aplicar direto.
    if (mudouValorFinal && peca.valor_enviado_cliente != null) {
      divergencias.push({
        bidPecaId: peca.id,
        modelo: peca.modelo,
        partNumber: peca.part_number,
        valorEnviadoCliente: peca.valor_enviado_cliente,
        valorAtual: peca.custo_peca_allied,
        valorNovo: custoPecaAllied,
      });
    }

    atualizacoes.push({
      id: peca.id,
      modelo: peca.modelo,
      part_number: peca.part_number,
      custo_peca_samsung: custoSamsung,
      valor_com_margem: valorComMargem,
      custo_peca_allied: custoPecaAllied,
      valor_imposto: valorImposto,
      valor_atualizado_em: valorAtualizadoEm,
      valor_direcao: valorDirecao,
    });
    historico.push({
      bid_peca_id: peca.id,
      custo_peca_samsung_anterior: peca.custo_peca_samsung,
      custo_peca_samsung_novo: custoSamsung,
      valor_com_margem_anterior: peca.valor_com_margem,
      valor_com_margem_novo: valorComMargem,
      custo_peca_allied_anterior: peca.custo_peca_allied,
      custo_peca_allied_novo: custoPecaAllied,
      valor_imposto_anterior: peca.valor_imposto,
      valor_imposto_novo: valorImposto,
      origem: "recalculo",
      alterado_por: user.id,
    });
  }

  // encontrou peça(s) já enviadas ao cliente cujo valor mudaria e ainda
  // não veio a confirmação explícita: não aplica NADA (nem as outras
  // peças sem divergência) — devolve a lista pra tela mostrar e o
  // usuário decidir, e a próxima chamada já vem com
  // confirmarDivergencias: true pra seguir de fato.
  if (divergencias.length > 0 && !confirmarDivergencias) {
    return NextResponse.json(
      {
        pendenteConfirmacao: true,
        divergencias,
        error: `${divergencias.length} peça(s) já enviada(s) ao cliente teriam o valor alterado por esse recálculo. Confirme antes de aplicar.`,
      },
      { status: 409 }
    );
  }

  if (divergencias.length > 0) {
    await admin.from("bid_reconciliacoes").insert(
      divergencias.map((d) => ({
        bid_peca_id: d.bidPecaId,
        part_number: d.partNumber,
        valor_enviado_cliente: d.valorEnviadoCliente,
        valor_anterior: d.valorAtual,
        valor_novo: d.valorNovo,
        origem: "recalculo",
        confirmado_por: user.id,
      }))
    );
  }

  // upsert em lote (uma única requisição por lote, atualizando só as
  // colunas informadas) em vez de um update por peça — com milhares de
  // peças, um update sequencial por linha estourava o limite de tempo
  // do plano gratuito da Vercel (10s por função). modelo/part_number vão
  // junto mesmo já existindo: o Postgres exige as colunas not null no
  // payload do upsert pra validar a linha, mesmo quando cai no caminho
  // de UPDATE (onConflict "id" já garante que não duplica nada).
  for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE) {
    const lote = atualizacoes.slice(i, i + TAMANHO_LOTE);
    const { error } = await admin.from("bid_pecas").upsert(lote, { onConflict: "id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // grava o "lote" desse recálculo — é o que permite reabrir depois,
  // pela tela Base BID, a lista de peças e os valores (o que era e o
  // que passou a ser) desse clique específico em "Recalcular". Só cria
  // o lote quando algo de fato mudou, pra não poluir o histórico com um
  // registro vazio toda vez que alguém clica em "Recalcular" sem que a
  // Base Peças tenha mudado nada.
  let recalculoId: string | null = null;
  if (atualizacoes.length > 0) {
    const { data: recalculo, error: erroRecalculo } = await admin
      .from("bid_recalculos")
      .insert({
        executado_por: user.id,
        pecas_verificadas: pecas.length,
        pecas_alteradas: atualizacoes.length,
      })
      .select("id")
      .single();
    if (erroRecalculo) {
      return NextResponse.json({ error: erroRecalculo.message }, { status: 400 });
    }
    recalculoId = recalculo.id;
    for (const linha of historico) linha.recalculo_id = recalculoId;
  }

  for (let i = 0; i < historico.length; i += TAMANHO_LOTE) {
    await admin.from("bid_historico_valores").insert(historico.slice(i, i + TAMANHO_LOTE));
  }

  return NextResponse.json({
    pecasVerificadas: pecas.length,
    pecasAlteradas: atualizacoes.length,
    divergenciasConfirmadas: divergencias.length,
    recalculoId,
  });
}
