import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_PECAS } from "@/lib/orcamentos";

// Marca/desmarca "Pedido feito" de um aparelho em "5 - Ag. Peças" —
// botão individual na tela (ver PainelAgPecas.tsx). Não tem trava de
// cargo (igual ao check individual de "Análise realizada" em
// 2 - Ag. Análise) — qualquer um que acesse a tela pode marcar/desmarcar
// um item por vez; só a ação em lote é restrita (ver
// pedido-peca-em-massa).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const feito = Boolean(body?.feito);

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Aparelho não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== STATUS_AG_PECAS) {
    return NextResponse.json(
      { error: "Esse aparelho não está mais em 5 - Ag. Peças (alguém já deve ter mexido nele)." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      pedido_peca_feito: feito,
      pedido_peca_feito_em: feito ? new Date().toISOString() : null,
      pedido_peca_feito_por: feito ? user.id : null,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, feito });
}
