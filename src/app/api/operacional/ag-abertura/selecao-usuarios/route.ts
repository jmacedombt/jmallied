import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Marca/desmarca um usuário Operacional na divisão de cores de Ag.
// Abertura (ver migration 0044, PainelAgAbertura.tsx). Compartilhado:
// qualquer usuário autenticado que tenha acesso a essa tela pode marcar
// ou desmarcar QUALQUER nome — é só um indicador visual de quem está
// cuidando de qual bloco, não trava a edição de ninguém.

async function usuarioAutenticado() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const user = await usuarioAutenticado();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const usuarioId = String(body.usuario_id ?? "").trim();
  if (!usuarioId) {
    return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ag_abertura_selecao_usuarios").upsert(
    {
      usuario_id: usuarioId,
      selecionado_por: user.id,
      selecionado_em: new Date().toISOString(),
    },
    { onConflict: "usuario_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await usuarioAutenticado();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const usuarioId = String(body.usuario_id ?? "").trim();
  if (!usuarioId) {
    return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ag_abertura_selecao_usuarios").delete().eq("usuario_id", usuarioId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
