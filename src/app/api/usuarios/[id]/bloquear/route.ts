import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

// Bloqueia ou desbloqueia o login de um usuário (não exclui o cadastro
// nem o histórico — só impede a pessoa de entrar no sistema). Restrito
// a Gerente, Diretor ou Administrador.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: perfilChamador } = await admin
    .from("usuarios")
    .select("cargo, is_master")
    .eq("id", user.id)
    .single();

  if (!podeGerenciarUsuarios(perfilChamador)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para bloquear usuários." },
      { status: 403 }
    );
  }

  if (params.id === user.id) {
    return NextResponse.json({ error: "Você não pode bloquear o próprio usuário." }, { status: 400 });
  }

  const { data: alvo } = await admin
    .from("usuarios")
    .select("id, is_master, bloqueado_em")
    .eq("id", params.id)
    .single();

  if (!alvo) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (alvo.is_master && !perfilChamador?.is_master) {
    return NextResponse.json(
      { error: "Só um Administrador pode bloquear outro Administrador." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const bloquear = body.bloquear !== false; // default: bloquear

  const { error: authError } = await admin.auth.admin.updateUserById(alvo.id, {
    ban_duration: bloquear ? "876000h" : "none", // ~100 anos = "pra sempre" até desbloquear
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data, error } = await admin
    .from("usuarios")
    .update({
      bloqueado_em: bloquear ? new Date().toISOString() : null,
      bloqueado_por: bloquear ? user.id : null,
    })
    .eq("id", alvo.id)
    .select("id, bloqueado_em")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
