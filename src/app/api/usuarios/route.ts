import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { CARGOS, SENHA_PADRAO, gerarUsuario, usuarioParaEmailTecnico } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

/**
 * Rotina de cadastro de usuário.
 * - Confere se quem está chamando está logado E se o cargo dele pode
 *   gerenciar usuários (Gerente, Diretor ou Administrador — mesma trava
 *   já usada em editar/bloquear/resetar senha, ver lib/usuarios.ts).
 *   FALHA DE SEGURANÇA CORRIGIDA (29/09/2026): essa checagem não
 *   existia — qualquer usuário logado, de qualquer cargo (inclusive os
 *   mais restritos, como Operacional/Técnico/Estoque/Financeiro),
 *   conseguia chamar essa rota direto (sem passar pela tela) e criar um
 *   usuário novo com cargo "Diretor" pra si mesmo, ganhando acesso total
 *   ao Sistema > Usuários e a todo o resto que só cargo de gestão libera
 *   — só não chegava a "is_master" (Administrador de verdade), que
 *   nenhuma rota aceita no corpo da requisição.
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

  const admin = createAdminClient();

  const { data: perfilChamador } = await admin
    .from("usuarios")
    .select("cargo, is_master")
    .eq("id", user.id)
    .single();

  if (!podeGerenciarUsuarios(perfilChamador)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para cadastrar usuários." },
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

  if (!nome || !sobrenome || !email || !cargo) {
    return NextResponse.json(
      { error: "Preencha nome, sobrenome, e-mail e cargo." },
      { status: 400 }
    );
  }

  if (!CARGOS.includes(cargo)) {
    return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  }

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
