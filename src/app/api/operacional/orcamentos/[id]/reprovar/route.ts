import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_ORCAMENTO_REPROVADO, STATUS_ORCAMENTO_FECHADOS } from "@/lib/orcamentos";

// Reprova manualmente um orçamento — ícone de cancelamento disponível em
// qualquer etapa do Operacional antes de "8 - Orçamento Reprovado" ou
// "Produto Entregue" (ver PopupReprovarOrcamento.tsx). Grava a
// justificativa e avança o orçamento direto pra "8 - Orçamento
// Reprovado", não importa em qual etapa ele estava.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const motivo = String(body?.motivo_reprova ?? "").trim();
  if (!motivo) {
    return NextResponse.json({ error: "Informe a justificativa da reprovação." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  if ((STATUS_ORCAMENTO_FECHADOS as readonly string[]).includes(atual.status_operacional)) {
    return NextResponse.json(
      { error: "Esse orçamento já está numa etapa final (Reprovado ou Entregue) — não dá pra reprovar de novo." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_ORCAMENTO_REPROVADO,
      motivo_reprova: motivo,
      reprovado_por: user.id,
      reprovado_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
