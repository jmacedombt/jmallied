import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { SENHA_PADRAO } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

// Reseta a senha de um usuário de volta pra senha padrão (Allied001) e
// obriga a troca no próximo acesso — útil quando a pessoa esquece a
// senha. Restrito a Gerente, Diretor ou Administrador.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
      { error: "Seu cargo não tem permissão para resetar senha de usuários." },
      { status: 403 }
    );
  }

  const { data: alvo } = await admin
    .from("usuarios")
    .select("id, usuario, is_master")
    .eq("id", params.id)
    .single();

  if (!alvo) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (alvo.is_master && !perfilChamador?.is_master) {
    return NextResponse.json(
      { error: "Só um Administrador pode resetar a senha de outro Administrador." },
      { status: 403 }
    );
  }

  const { error: authError } = await admin.auth.admin.updateUserById(alvo.id, {
    password: SENHA_PADRAO,
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  await admin.from("usuarios").update({ must_change_password: true }).eq("id", alvo.id);

  return NextResponse.json({ usuario: alvo.usuario, senhaTemporaria: SENHA_PADRAO });
}
