import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAGINA_TAMANHO = 20;

// Lista os últimos recálculos do BID (um por clique em "Recalcular" que
// mudou pelo menos uma peça) — mostrado no popup "Ver histórico de
// recálculos" da tela Base BID.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pagina = Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);
  const inicio = (pagina - 1) * PAGINA_TAMANHO;

  const { data, count, error } = await supabase
    .from("bid_recalculos")
    .select("id, executado_em, pecas_verificadas, pecas_alteradas, usuarios:executado_por (nome, sobrenome)", {
      count: "exact",
    })
    .order("executado_em", { ascending: false })
    .range(inicio, inicio + PAGINA_TAMANHO - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    recalculos: data ?? [],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / PAGINA_TAMANHO)),
  });
}
