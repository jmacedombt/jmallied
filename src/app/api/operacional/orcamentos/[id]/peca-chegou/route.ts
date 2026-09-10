import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_PECAS, STATUS_AG_REPARO } from "@/lib/orcamentos";

// "Peça chegou" — avança um aparelho de "5 - Ag. Peças" pra "6 - Ag.
// Reparo" (botão individual, ver PainelAgPecas.tsx). Só libera depois
// que "Pedido feito" foi marcado (não faz sentido a peça chegar sem
// pedido). Sem trava de cargo — igual ao check individual de "Análise
// realizada"; só a ação em lote é restrita (ver peca-chegou-em-massa).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
    .select("status_operacional, pedido_peca_feito")
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

  if (!atual.pedido_peca_feito) {
    return NextResponse.json(
      { error: "Marque \"Pedido feito\" antes de confirmar a chegada da peça." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({ status_operacional: STATUS_AG_REPARO, peca_chegou_em: new Date().toISOString() })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
