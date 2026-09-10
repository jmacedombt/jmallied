import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarChegadaPecaEmLote, STATUS_AG_PECAS, STATUS_AG_REPARO } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// "Peça chegou" em lote — avança vários aparelhos de "5 - Ag. Peças" pra
// "6 - Ag. Reparo" de uma vez (seleção múltipla). Só visível/liberado
// pra Supervisor, Gerente ou Administrador (ver
// podeConfirmarChegadaPecaEmLote). Só mexe nos que estiverem em
// "5 - Ag. Peças" E já tiverem "Pedido feito" marcado — qualquer
// selecionado sem pedido feito é ignorado (não conta no total
// devolvido), sem travar os demais.
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

  if (!podeConfirmarChegadaPecaEmLote(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão pra confirmar chegada de peça em lote." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  const agora = new Date().toISOString();
  let confirmados = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .update({ status_operacional: STATUS_AG_REPARO, peca_chegou_em: agora })
      .in("id", lote)
      .eq("status_operacional", STATUS_AG_PECAS)
      .eq("pedido_peca_feito", true)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    confirmados += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, confirmados, selecionados: ids.length });
}
