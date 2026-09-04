import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { calcularCustoPecaAllied, direcaoValor, podeImportarBid, type FaixaMarkup, type InfoBidPeca } from "@/lib/bid";

// Cadastro manual de uma peça do BID que ainda não tem custo calculado —
// aberto a partir do popup de peças em Ag. Análise quando um Part
// Number do orçamento não é encontrado no BID (ou está lá sem custo).
// Sempre recalcula o valor final no servidor (nunca confia no valor que
// o cliente mostrou na pré-visualização), pros dois caminhos baterem.
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para cadastrar peças do BID." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const modelo = String(body?.modelo ?? "").trim();
  const partNumber = String(body?.part_number ?? "").trim();
  const pecaSolucao = String(body?.peca_solucao ?? "").trim();
  const custoSamsung = Number(body?.custo_peca_samsung);
  const maoDeObra = Number(body?.mao_de_obra);

  if (!modelo || !partNumber || !pecaSolucao) {
    return NextResponse.json({ error: "Preencha Modelo, Part Number e Peça Solução." }, { status: 400 });
  }
  if (!Number.isFinite(custoSamsung) || custoSamsung <= 0) {
    return NextResponse.json({ error: "Informe um Custo Peça Samsung válido." }, { status: 400 });
  }
  if (![80, 150].includes(maoDeObra)) {
    return NextResponse.json({ error: "Mão de Obra deve ser 80 ou 150." }, { status: 400 });
  }

  const [{ data: faixasBrutas }, { data: configImposto }] = await Promise.all([
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
  ]);

  const faixas: FaixaMarkup[] = (
    (faixasBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));
  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);

  const resultado = calcularCustoPecaAllied(custoSamsung, faixas, icmsPercentual);
  if (!resultado) {
    return NextResponse.json(
      { error: "Nenhuma faixa de markup configurada cobre esse valor. Confira Configurações > Faixas de Markup." },
      { status: 400 }
    );
  }

  const { data: existente } = await admin
    .from("bid_pecas")
    .select("id, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, valor_atualizado_em, valor_direcao")
    .eq("modelo", modelo)
    .eq("part_number", partNumber)
    .maybeSingle();

  const mudouValor = existente ? existente.custo_peca_allied == null || existente.custo_peca_allied !== resultado.custoPecaAllied : true;
  const valorAtualizadoEm = !existente || mudouValor ? new Date().toISOString() : existente.valor_atualizado_em;
  const valorDirecao = !existente
    ? "+"
    : mudouValor
      ? direcaoValor(existente.custo_peca_allied, resultado.custoPecaAllied)
      : existente.valor_direcao;

  const { data: pecaSalva, error: erroUpsert } = await admin
    .from("bid_pecas")
    .upsert(
      {
        modelo,
        part_number: partNumber,
        custo_peca_samsung: custoSamsung,
        valor_com_margem: resultado.valorComMargem,
        custo_peca_allied: resultado.custoPecaAllied,
        valor_imposto: resultado.valorImposto,
        mao_de_obra: maoDeObra,
        valor_atualizado_em: valorAtualizadoEm,
        valor_direcao: valorDirecao,
      },
      { onConflict: "modelo,part_number" }
    )
    .select("id")
    .single();

  if (erroUpsert || !pecaSalva) {
    return NextResponse.json({ error: erroUpsert?.message || "Não consegui salvar essa peça." }, { status: 400 });
  }

  // garante a solução como principal se for a primeira dessa peça
  const { data: solucoesExistentes } = await admin
    .from("bid_solucoes")
    .select("id, peca_solucao")
    .eq("bid_peca_id", pecaSalva.id);

  const jaTemEssaSolucao = (solucoesExistentes ?? []).some(
    (s: { peca_solucao: string }) => s.peca_solucao.trim().toLowerCase() === pecaSolucao.toLowerCase()
  );
  if (!jaTemEssaSolucao) {
    await admin.from("bid_solucoes").insert({
      bid_peca_id: pecaSalva.id,
      peca_solucao: pecaSolucao,
      principal: (solucoesExistentes ?? []).length === 0,
    });
  }

  await admin.from("bid_historico_valores").insert({
    bid_peca_id: pecaSalva.id,
    custo_peca_samsung_anterior: existente?.custo_peca_samsung ?? null,
    custo_peca_samsung_novo: custoSamsung,
    valor_com_margem_anterior: existente?.valor_com_margem ?? null,
    valor_com_margem_novo: resultado.valorComMargem,
    custo_peca_allied_anterior: existente?.custo_peca_allied ?? null,
    custo_peca_allied_novo: resultado.custoPecaAllied,
    valor_imposto_anterior: existente?.valor_imposto ?? null,
    valor_imposto_novo: resultado.valorImposto,
    origem: "edicao_manual",
    alterado_por: user.id,
  });

  const infoBid: InfoBidPeca = {
    id: pecaSalva.id,
    modelo,
    part_number: partNumber,
    peca_solucao: pecaSolucao,
    custo_peca_samsung: custoSamsung,
    valor_com_margem: resultado.valorComMargem,
    custo_peca_allied: resultado.custoPecaAllied,
    valor_imposto: resultado.valorImposto,
    mao_de_obra: maoDeObra,
    travado: false,
  };

  return NextResponse.json(infoBid);
}
