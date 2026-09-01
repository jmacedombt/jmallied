import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Troca qual "Peça Solução" fica em destaque (principal) pra uma peça
// do BID que tem mais de uma. Não mexe em custo/valor — é só exibição.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const solucaoId = String(body.solucao_id ?? "").trim();

  if (!solucaoId) {
    return NextResponse.json({ error: "Informe a solução escolhida." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: solucao, error: erroSolucao } = await admin
    .from("bid_solucoes")
    .select("id, bid_peca_id")
    .eq("id", solucaoId)
    .single();

  if (erroSolucao || !solucao || solucao.bid_peca_id !== params.id) {
    return NextResponse.json({ error: "Solução não encontrada pra essa peça." }, { status: 404 });
  }

  // tira o "principal" de todas as soluções dessa peça, depois marca só
  // a escolhida (evita violar o índice único parcial "1 principal por peça")
  const { error: erroLimpar } = await admin.from("bid_solucoes").update({ principal: false }).eq("bid_peca_id", params.id);
  if (erroLimpar) {
    return NextResponse.json({ error: erroLimpar.message }, { status: 400 });
  }

  const { error: erroMarcar } = await admin.from("bid_solucoes").update({ principal: true }).eq("id", solucaoId);
  if (erroMarcar) {
    return NextResponse.json({ error: erroMarcar.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
