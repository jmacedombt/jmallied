import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buscarUsuariosParaChat } from "@/lib/chat";

// Lista de usuários pra começar uma conversa nova no chat interno
// (pedido explícito) — todo login ativo, inclusive ALLIED, menos quem
// está bloqueado. Só nome/sobrenome/cargo, nada sensível.
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
    const usuarios = await buscarUsuariosParaChat(admin, user.id);
    return NextResponse.json({ usuarios });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível carregar a lista de usuários." },
      { status: 400 }
    );
  }
}
