import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Resumo usado pelo sininho de notificações no topo da tela — por
 * enquanto só conta pendências de cadastro no BID (peças sem Custo Peça
 * Samsung). Qualquer usuário autenticado pode ver essa contagem, não é
 * informação sensível por cargo.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("bid_pecas")
    .select("id", { count: "exact", head: true })
    .is("custo_peca_samsung", null);

  return NextResponse.json({ pendenciasBid: count ?? 0 });
}
