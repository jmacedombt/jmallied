import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento, STATUS_AG_CONTRA_PROPOSTA, type PecaContraProposta } from "@/lib/orcamentos";

// "Confirmar alteração" do pop-up de peças em Ag. Contra Proposta — grava
// o valor negociado de cada peça (vendaNova) e a mão de obra, e marca
// esse aparelho como ajustado (flag azul na lista, e trava que libera o
// botão "Enviar Contra Proposta" do lote quando TODOS estiverem assim).
export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para ajustar a Contra Proposta." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const pecas = body?.pecas;
  const maoDeObra = Number(body?.mao_de_obra);

  if (!Array.isArray(pecas) || !Number.isFinite(maoDeObra) || maoDeObra < 0) {
    return NextResponse.json({ error: "Informe as peças e a mão de obra corretamente." }, { status: 400 });
  }

  const pecasValidadas: PecaContraProposta[] = [];
  for (const p of pecas) {
    const vendaNova = Number(p?.vendaNova);
    if (!p?.posicao || !p?.codigo || !Number.isFinite(vendaNova) || vendaNova < 0) {
      return NextResponse.json({ error: "Valor inválido em uma das peças." }, { status: 400 });
    }
    pecasValidadas.push({
      posicao: String(p.posicao),
      codigo: String(p.codigo),
      custo: Number(p.custo) || 0,
      imposto: Number(p.imposto) || 0,
      vendaOriginal: Number(p.vendaOriginal) || 0,
      vendaNova,
    });
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }
  if (atual.status_operacional !== STATUS_AG_CONTRA_PROPOSTA) {
    return NextResponse.json({ error: "Esse orçamento não está em Ag. Contra Proposta." }, { status: 409 });
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      contra_proposta_pecas: pecasValidadas,
      contra_proposta_mao_de_obra: maoDeObra,
      contra_proposta_ajustado: true,
      contra_proposta_ajustado_por: user.id,
      contra_proposta_ajustado_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
