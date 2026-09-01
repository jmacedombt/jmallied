import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIMITE = 40;

// Busca instantânea por Part Number (aceita começo ou qualquer trecho)
// pra tela Bases > Consulta BID.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const termo = (searchParams.get("q") ?? "").trim();

  if (termo.length < 2) {
    return NextResponse.json({ pecas: [] });
  }

  const { data, error } = await supabase
    .from("bid_pecas")
    .select(
      "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, mao_de_obra, bid_solucoes(id, peca_solucao, principal)"
    )
    .ilike("part_number", `%${termo}%`)
    .order("part_number", { ascending: true })
    .limit(LIMITE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ pecas: data ?? [] });
}
