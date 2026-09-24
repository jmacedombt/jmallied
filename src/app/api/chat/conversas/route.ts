import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buscarConversas } from "@/lib/chat";

// Lista de conversas do chat interno (pedido explícito) — quem já
// trocou mensagem com o usuário logado, última mensagem e quantas ainda
// não foram lidas, mais recente primeiro.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  try {
    const conversas = await buscarConversas(admin, user.id);
    return NextResponse.json({ conversas });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível carregar as conversas." },
      { status: 400 }
    );
  }
}
