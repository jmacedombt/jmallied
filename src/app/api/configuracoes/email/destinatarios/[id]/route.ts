import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfigurarEmail } from "@/lib/email";

async function checarPermissao() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado." };

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfigurarEmail(perfil)) {
    return { ok: false as const, status: 403, error: "Seu cargo não tem permissão para alterar essa configuração." };
  }
  return { ok: true as const, admin };
}

// Liga/desliga um destinatário (pausa o envio pra esse e-mail sem apagar
// o cadastro) — Configurações > E-mail.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const permissao = await checarPermissao();
  if (!permissao.ok) return NextResponse.json({ error: permissao.error }, { status: permissao.status });

  const body = await request.json().catch(() => null);
  const ativo = Boolean(body?.ativo);

  const { data, error } = await permissao.admin
    .from("configuracoes_email_destinatarios")
    .update({ ativo })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const permissao = await checarPermissao();
  if (!permissao.ok) return NextResponse.json({ error: permissao.error }, { status: permissao.status });

  const { error } = await permissao.admin.from("configuracoes_email_destinatarios").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
