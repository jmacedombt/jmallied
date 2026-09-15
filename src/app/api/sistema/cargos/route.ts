import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

/**
 * Cadastra um cargo no registro de referência (SISTEMA > Cargos) — só
 * isso: nome + descrição do que foi pedido pra esse cargo acessar.
 *
 * Importante: isso NÃO cria nenhuma permissão de verdade. O cargo só
 * fica disponível de fato pra atribuir a um usuário (menu Usuários) e
 * ganha acesso a módulos quando alguém implementa isso em código (do
 * jeito que ALLIED, Operacional e Triagem/OQC foram feitos) — a tela
 * deixa esse aviso explícito antes de cadastrar.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("cargo, is_master")
    .eq("id", user.id)
    .single();

  if (!podeGerenciarUsuarios(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra cadastrar cargos." }, { status: 403 });
  }

  const body = await request.json();
  const nome = (body.nome || "").trim();
  const descricao = (body.descricao || "").trim();

  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do cargo." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existente } = await admin
    .from("cargos_customizados")
    .select("id")
    .ilike("nome", nome)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ error: "Já existe um cargo registrado com esse nome." }, { status: 400 });
  }

  const { error } = await admin.from("cargos_customizados").insert({
    nome,
    descricao: descricao || null,
    criado_por: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
