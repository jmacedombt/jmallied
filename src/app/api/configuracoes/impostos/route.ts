import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

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

  if (!podeImportarBid(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para alterar essa configuração." }, { status: 403 });
  }

  const body = await request.json();
  const icmsPercentual = Number(body.icms_percentual);

  if (!Number.isFinite(icmsPercentual) || icmsPercentual < 0 || icmsPercentual > 100) {
    return NextResponse.json({ error: "Informe um percentual válido, entre 0 e 100." }, { status: 400 });
  }

  const { error } = await admin
    .from("configuracoes_impostos")
    .update({
      icms_percentual: icmsPercentual,
      atualizado_por: user.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
