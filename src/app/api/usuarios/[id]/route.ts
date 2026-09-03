import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CARGOS, usuarioParaEmailTecnico } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

// Edita o cadastro de um usuário já existente (nome, sobrenome, e-mail,
// telefone, cargo e usuário/login). Restrito a Gerente, Diretor ou
// Administrador. Se o login (usuario) mudar, atualiza também o e-mail
// técnico usado no Supabase Auth pra login continuar funcionando.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
      { error: "Seu cargo não tem permissão para editar usuários." },
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
      { error: "Só um Administrador pode alterar o cadastro de outro Administrador." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const nome = (body.nome || "").trim();
  const sobrenome = (body.sobrenome || "").trim();
  const email = (body.email || "").trim();
  const telefone = (body.telefone || "").trim();
  const cargo = body.cargo;
  const usuarioDesejado = (body.usuario || "").trim().toLowerCase();

  if (!nome || !sobrenome || !email || !cargo || !usuarioDesejado) {
    return NextResponse.json(
      { error: "Preencha nome, sobrenome, e-mail, cargo e usuário." },
      { status: 400 }
    );
  }

  if (!CARGOS.includes(cargo)) {
    return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  }

  // se o login mudou, confere que o novo nome não colide com outro usuário
  const loginMudou = usuarioDesejado !== alvo.usuario;
  if (loginMudou) {
    const { data: existente } = await admin
      .from("usuarios")
      .select("id")
      .eq("usuario", usuarioDesejado)
      .neq("id", alvo.id)
      .maybeSingle();

    if (existente) {
      return NextResponse.json({ error: "Esse usuário (login) já está em uso." }, { status: 409 });
    }

    const { error: authError } = await admin.auth.admin.updateUserById(alvo.id, {
      email: usuarioParaEmailTecnico(usuarioDesejado),
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  const { data, error } = await admin
    .from("usuarios")
    .update({ nome, sobrenome, email, telefone, cargo, usuario: usuarioDesejado })
    .eq("id", alvo.id)
    .select("id, nome, sobrenome, usuario, email, telefone, cargo, is_master")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
