import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarPedidoPecaEmLote, STATUS_AG_PECAS } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// Marca "Pedido feito" em lote pra vários aparelhos de uma vez (seleção
// múltipla em "5 - Ag. Peças") — só visível/liberado pra Supervisor,
// Gerente ou Administrador (ver podeConfirmarPedidoPecaEmLote). Só mexe
// nos que ainda estiverem em "5 - Ag. Peças" (evita reprocessar um
// aparelho que alguém já marcou individualmente entre a seleção e o
// clique).
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

  if (!podeConfirmarPedidoPecaEmLote(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão pra marcar pedido de peça em lote." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  const feito = Boolean(body?.feito);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  const agora = new Date().toISOString();
  let confirmados = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .update({
        pedido_peca_feito: feito,
        pedido_peca_feito_em: feito ? agora : null,
        pedido_peca_feito_por: feito ? user.id : null,
      })
      .in("id", lote)
      .eq("status_operacional", STATUS_AG_PECAS)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    confirmados += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, confirmados });
}
