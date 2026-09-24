import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarUsuariosOnline } from "@/lib/presenca";

// Lista "Usuários Online" (pedido explícito) — visível pra todo login,
// inclusive ALLIED desde a migration 0068 (antes era escondido desse
// cargo, ver migration 0058).
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const usuarios = await buscarUsuariosOnline(supabase);
    return NextResponse.json({ usuarios });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível carregar os usuários online." },
      { status: 400 }
    );
  }
}
