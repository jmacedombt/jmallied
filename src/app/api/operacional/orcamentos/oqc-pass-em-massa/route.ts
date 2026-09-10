import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarOqcEmLote, STATUS_OQC, STATUS_REPARO_FINALIZADO } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// "OQC PASS" em lote (seleção múltipla em "OQC - Controle de
// Qualidade") — só visível/liberado pra Supervisor, Gerente ou
// Administrador (ver podeConfirmarOqcEmLote). Só mexe nos que ainda
// estiverem em OQC (evita reprocessar um aparelho que alguém já
// confirmou individualmente entre a seleção e o clique), e grava uma
// linha em oqc_avaliacoes por aparelho efetivamente avançado.
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
    return NextResponse.json({ error: "Seu cargo não tem permissão pra confirmar OQC PASS em lote." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  let confirmados = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data: atualizados, error } = await admin
      .from("orcamentos")
      .update({ status_operacional: STATUS_REPARO_FINALIZADO })
      .in("id", lote)
      .eq("status_operacional", STATUS_OQC)
      .select("id, nf_remessa_allied, trade_allied");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    confirmados += atualizados?.length ?? 0;

    if (atualizados && atualizados.length > 0) {
      await admin.from("oqc_avaliacoes").insert(
        atualizados.map((a: { id: string; nf_remessa_allied: string | null; trade_allied: string | null }) => ({
          orcamento_id: a.id,
          resultado: "pass",
          avaliado_por: user.id,
          nf_remessa_allied: a.nf_remessa_allied,
          trade_allied: a.trade_allied,
        }))
      );
    }
  }

  return NextResponse.json({ ok: true, confirmados });
}
