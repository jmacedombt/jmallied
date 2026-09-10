import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarOqcEmLote, STATUS_AG_REPARO, STATUS_OQC } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// "OQC FAIL" em lote (seleção múltipla em "OQC - Controle de
// Qualidade") — mesma permissão de podeConfirmarOqcEmLote. Aplica a
// MESMA justificativa a todos os selecionados, igual o padrão já usado
// em "Reprovar em massa" (ver reprovar-em-massa/route.ts). Só mexe nos
// que ainda estiverem em OQC, e volta todos pra "6 - Ag. Reparo".
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

  if (!podeConfirmarOqcEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra confirmar OQC FAIL em lote." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  const motivo = String(body?.motivo ?? "").trim();

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "Informe o motivo da reprovação no OQC." }, { status: 400 });
  }

  let reprovados = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data: atualizados, error } = await admin
      .from("orcamentos")
      .update({ status_operacional: STATUS_AG_REPARO })
      .in("id", lote)
      .eq("status_operacional", STATUS_OQC)
      .select("id, nf_remessa_allied, trade_allied");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    reprovados += atualizados?.length ?? 0;

    if (atualizados && atualizados.length > 0) {
      await admin.from("oqc_avaliacoes").insert(
        atualizados.map((a: { id: string; nf_remessa_allied: string | null; trade_allied: string | null }) => ({
          orcamento_id: a.id,
          resultado: "fail",
          motivo,
          avaliado_por: user.id,
          nf_remessa_allied: a.nf_remessa_allied,
          trade_allied: a.trade_allied,
        }))
      );
    }
  }

  return NextResponse.json({ ok: true, reprovados });
}
