import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { CARGOS, SENHA_PADRAO, gerarUsuario, usuarioParaEmailTecnico } from "@/lib/auth";

/**
 * Rotina de cadastro de usuário.
 * - Confere se quem está chamando está logado (autorização por cargo
 *   fica para quando as regras forem definidas).
 * - Gera o usuário (nome.sobrenome), evitando colisão.
 * - Cria a conta no Supabase Auth com a senha padrão Allied001.
 * - Cria o perfil em public.usuarios com must_change_password = true.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const nome = (body.nome || "").trim();
  const sobrenome = (body.sobrenome || "").trim();
  const email = (body.email || "").trim();
  const telefone = (body.telefone || "").trim();
  const cargo = body.cargo;
  const usuarioDesejado = (body.usuario || "").trim().toLowerCase();

  if (!nome || !sobrenome || !email || !cargo) {
    return NextResponse.json(
      { error: "Preencha nome, sobrenome, e-mail e cargo." },
      { status: 400 }
    );
  }

  if (!CARGOS.includes(cargo)) {
    return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const base = usuarioDesejado || gerarUsuario(nome, sobrenome);
  let usuarioFinal = base;
  let sufixo = 1;

  // evita colisão de usuário já existente
  while (true) {
    const { data: existente } = await admin
      .from("usuarios")
      .select("id")
      .eq("usuario", usuarioFinal)
      .maybeSingle();

    if (!existente) break;
    sufixo += 1;
    usuarioFinal = `${base}${sufixo}`;
  }

  const emailTecnico = usuarioParaEmailTecnico(usuarioFinal);

  const { data: novoAuthUser, error: authError } = await admin.auth.admin.createUser({
    email: emailTecnico,
    password: SENHA_PADRAO,
    email_confirm: true,
  });

  if (authError || !novoAuthUser?.user) {
    return NextResponse.json(
      { error: authError?.message || "Não foi possível criar o acesso." },
      { status: 400 }
    );
  }

  const { error: perfilError } = await admin.from("usuarios").insert({
    id: novoAuthUser.user.id,
    nome,
    sobrenome,
    usuario: usuarioFinal,
    email,
    telefone,
    cargo,
    must_change_password: true,
    is_master: false,
  });

  if (perfilError) {
    // desfaz a criação do login se não conseguiu salvar o perfil
    await admin.auth.admin.deleteUser(novoAuthUser.user.id);
    return NextResponse.json({ error: perfilError.message }, { status: 400 });
  }

  return NextResponse.json({
    usuario: usuarioFinal,
    senhaTemporaria: SENHA_PADRAO,
  });
}
