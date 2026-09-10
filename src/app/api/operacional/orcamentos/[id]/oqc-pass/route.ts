import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_OQC, STATUS_REPARO_FINALIZADO } from "@/lib/orcamentos";

// "OQC PASS" — aparelho passou no controle de qualidade e avança pra
// "7 - Reparo Finalizado". Ícone disponível pra qualquer um que acesse a
// tela (cadastro individual não é restrito, igual o resto do sistema —
// só o modo em massa é gated, ver oqc-pass-em-massa). Grava uma linha em
// oqc_avaliacoes (resultado='pass') — base da Métrica de OQC.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
    .update({ status_operacional: STATUS_REPARO_FINALIZADO })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: erroAvaliacao } = await admin.from("oqc_avaliacoes").insert({
    orcamento_id: params.id,
    resultado: "pass",
    avaliado_por: user.id,
    nf_remessa_allied: atual.nf_remessa_allied,
    trade_allied: atual.trade_allied,
  });

  if (erroAvaliacao) {
    // o avanço de status já foi salvo — só a métrica que não vai
    // refletir essa avaliação. Não desfaz o avanço (evita deixar o
    // aparelho travado numa transição pela metade); só avisa.
    return NextResponse.json(
      { ok: true, aviso: `Aparelho avançado, mas não foi possível registrar na Métrica de OQC (${erroAvaliacao.message}).` }
    );
  }

  return NextResponse.json({ ok: true });
}
