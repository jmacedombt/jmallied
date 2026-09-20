import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";
import { mesAtualIso } from "@/lib/impostos";

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

  const agora = new Date().toISOString();

  const { error } = await admin
    .from("configuracoes_impostos")
    .update({
      icms_percentual: icmsPercentual,
      atualizado_por: user.id,
      atualizado_em: agora,
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // registra (ou corrige, se já tiver sido salvo antes dentro do mesmo
  // mês) o valor do mês atual no histórico — ver migration 0054 e o
  // gráfico de evolução em configuracoes/impostos/page.tsx.
  const { error: erroHistorico } = await admin.from("configuracoes_impostos_historico").upsert(
    {
      mes: mesAtualIso(),
      icms_percentual: icmsPercentual,
      atualizado_por: user.id,
      atualizado_em: agora,
    },
    { onConflict: "mes" }
  );

  if (erroHistorico) {
    return NextResponse.json({ error: erroHistorico.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
