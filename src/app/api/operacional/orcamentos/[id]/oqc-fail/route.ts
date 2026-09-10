import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_REPARO, STATUS_OQC } from "@/lib/orcamentos";

// "OQC FAIL" — aparelho reprovou no controle de qualidade: volta pra
// "6 - Ag. Reparo" (pra reparar de novo), com o motivo gravado em
// oqc_avaliacoes (resultado='fail'). É essa tabela que conta quantas
// vezes esse orçamento já falhou no OQC (1x, 2x, 3x...) — mostrado como
// tag "OQC FAIL xN" em 6 - Ag. Reparo (ver PainelAgReparo.tsx) — e que
// alimenta a Métrica de OQC.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const motivo = String(body?.motivo ?? "").trim();
  if (!motivo) {
    return NextResponse.json({ error: "Informe o motivo da reprovação no OQC." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional, nf_remessa_allied, trade_allied")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== STATUS_OQC) {
    return NextResponse.json(
      { error: "Esse aparelho não está mais em OQC - Controle de Qualidade." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({ status_operacional: STATUS_AG_REPARO })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: erroAvaliacao } = await admin.from("oqc_avaliacoes").insert({
    orcamento_id: params.id,
    resultado: "fail",
    motivo,
    avaliado_por: user.id,
    nf_remessa_allied: atual.nf_remessa_allied,
    trade_allied: atual.trade_allied,
  });

  if (erroAvaliacao) {
    return NextResponse.json(
      { ok: true, aviso: `Aparelho voltou pra Ag. Reparo, mas não foi possível registrar na Métrica de OQC (${erroAvaliacao.message}).` }
    );
  }

  return NextResponse.json({ ok: true });
}
