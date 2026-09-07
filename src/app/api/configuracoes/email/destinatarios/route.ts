import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfigurarEmail } from "@/lib/email";

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adiciona um e-mail à lista fixa de destinatários que recebem todo
// envio automático de Validação de Orçamentos (Configurações > E-mail).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfigurarEmail(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para alterar essa configuração." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const nome = body?.nome ? String(body.nome).trim() : null;

  if (!REGEX_EMAIL.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("configuracoes_email_destinatarios")
    .insert({ email, nome, criado_por: user.id })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Esse e-mail já está cadastrado." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
