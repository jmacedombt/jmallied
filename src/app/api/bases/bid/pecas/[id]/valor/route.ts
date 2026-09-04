import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

// Edição manual do Custo Peça (Allied) numa peça do BID (tela Consulta
// BID). Atualiza custo_peca_allied e o espelho valor_com_margem, e
// grava a mudança no histórico (origem "edicao_manual"). Não mexe em
// custo_peca_samsung nem no estado de trava — travar é uma ação à
// parte (ver .../travar).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para editar valores do BID." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const valor = Number(body?.valor);

  if (!Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  const valorArredondado = Math.round(valor * 100) / 100;

  const { data: peca, error: erroPeca } = await admin
    .from("bid_pecas")
    .select("id, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto")
    .eq("id", params.id)
    .single();

  if (erroPeca || !peca) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  // edição manual sobrescreve o valor final direto — deixa de refletir
  // a fórmula (markup + imposto), então zera valor_imposto (não dá mais
  // pra saber quanto dessa peça é imposto) até a peça ser recalculada.
  const { error: erroUpdate } = await admin
    .from("bid_pecas")
    .update({ valor_com_margem: valorArredondado, custo_peca_allied: valorArredondado, valor_imposto: null })
    .eq("id", params.id);

  if (erroUpdate) {
    return NextResponse.json({ error: erroUpdate.message }, { status: 400 });
  }

  await admin.from("bid_historico_valores").insert({
    bid_peca_id: params.id,
    custo_peca_samsung_anterior: peca.custo_peca_samsung,
    custo_peca_samsung_novo: peca.custo_peca_samsung,
    valor_com_margem_anterior: peca.valor_com_margem,
    valor_com_margem_novo: valorArredondado,
    custo_peca_allied_anterior: peca.custo_peca_allied,
    custo_peca_allied_novo: valorArredondado,
    valor_imposto_anterior: peca.valor_imposto,
    valor_imposto_novo: null,
    origem: "edicao_manual",
    alterado_por: user.id,
  });

  return NextResponse.json({
    ok: true,
    custo_peca_allied: valorArredondado,
    valor_com_margem: valorArredondado,
    valor_imposto: null,
  });
}
