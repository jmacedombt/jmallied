import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfigurarEmail } from "@/lib/email";

// Atualiza o remetente e o texto padrão (assunto/corpo) do e-mail
// automático de Validação de Orçamentos (Configurações > E-mail).
export async function PUT(request: Request) {
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
  const remetenteNome = String(body?.remetente_nome ?? "").trim();
  const remetenteEmail = String(body?.remetente_email ?? "").trim();
  const assuntoPadrao = String(body?.assunto_padrao ?? "").trim();
  const corpoPadrao = String(body?.corpo_padrao ?? "").trim();

  if (!remetenteNome) {
    return NextResponse.json({ error: "Informe o nome do remetente." }, { status: 400 });
  }
  if (remetenteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(remetenteEmail)) {
    return NextResponse.json({ error: "E-mail do remetente inválido." }, { status: 400 });
  }
  if (!assuntoPadrao || !corpoPadrao) {
    return NextResponse.json({ error: "Preencha o assunto e o corpo padrão do e-mail." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("configuracoes_email")
    .update({
      remetente_nome: remetenteNome,
      remetente_email: remetenteEmail || null,
      assunto_padrao: assuntoPadrao,
      corpo_padrao: corpoPadrao,
      atualizado_por: user.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
