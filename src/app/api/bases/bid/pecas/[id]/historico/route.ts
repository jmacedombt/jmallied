import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Histórico de variação de valor (custo Samsung / valor com margem) de
// uma peça do BID — mostrado ao expandir a linha na tela.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bid_historico_valores")
    .select(
      "id, custo_peca_samsung_anterior, custo_peca_samsung_novo, valor_com_margem_anterior, valor_com_margem_novo, origem, criado_em, usuarios:alterado_por (nome, sobrenome)"
    )
    .eq("bid_peca_id", params.id)
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ historico: data ?? [] });
}
