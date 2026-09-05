import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

function numeroValido(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

// Ajusta manualmente os 4 totais do resumo de um orçamento em Validação
// de Orçamentos (Venda de Peças, Custo, Imposto e Mão de obra — ver
// PopupPecasValidacao.tsx e migration 0021_validacao_ajuste_manual).
// Mesma permissão de quem já confirma o envio de um lote
// (podeConfirmarAnaliseEmLote). Com { reverter: true } no corpo, desfaz o
// ajuste e volta a calcular tudo automaticamente pela Base Peças/BID.
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

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra ajustar esses valores." }, { status: 403 });
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== STATUS_VALIDACAO_ORCAMENTOS) {
    return NextResponse.json(
      { error: "Esse orçamento não está mais em Validação de Orçamentos — atualize a tela." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);

  if (body?.reverter === true) {
    const { error } = await admin
      .from("orcamentos")
      .update({
        validacao_ajustado_manualmente: false,
        validacao_venda_manual: null,
        validacao_custo_manual: null,
        validacao_imposto_manual: null,
        validacao_mao_de_obra_manual: null,
        validacao_ajustado_por: null,
        validacao_ajustado_em: null,
      })
      .eq("id", params.id)
      .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const vendaPecas = Number(body?.venda_pecas);
  const custoPecas = Number(body?.custo_pecas);
  const impostoPecas = Number(body?.imposto_pecas);
  const maoDeObra = Number(body?.mao_de_obra);

  if (![vendaPecas, custoPecas, impostoPecas, maoDeObra].every(numeroValido)) {
    return NextResponse.json({ error: "Valores inválidos — todos precisam ser números, maiores ou iguais a zero." }, { status: 400 });
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      validacao_ajustado_manualmente: true,
      validacao_venda_manual: vendaPecas,
      validacao_custo_manual: custoPecas,
      validacao_imposto_manual: impostoPecas,
      validacao_mao_de_obra_manual: maoDeObra,
      validacao_ajustado_por: user.id,
      validacao_ajustado_em: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
