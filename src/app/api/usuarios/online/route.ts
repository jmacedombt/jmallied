import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAllied } from "@/lib/usuarios";
import { buscarUsuariosOnline } from "@/lib/presenca";

// Lista "Usuários Online" (pedido explícito) — visível pra todo login,
// menos ALLIED. Essa checagem aqui é só a primeira camada (também
// reforçada no middleware e, de novo, dentro da própria RPC
// usuarios_online_listar — ver migration 0058): mesmo que uma dessas
// falhe, as outras seguram.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (isAllied(perfil)) {
    return NextResponse.json({ error: "Não permitido para este cargo." }, { status: 403 });
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
