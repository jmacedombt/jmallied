import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

// Trava/destrava uma peça do BID (tela Consulta BID). Enquanto travada,
// importação do BID e "Recalcular" não sobrescrevem o preço dela.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para travar/destravar peças do BID." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const travado = Boolean(body?.travado);

  const { error } = await admin
    .from("bid_pecas")
    .update({
      travado,
      travado_por: travado ? user.id : null,
      travado_em: travado ? new Date().toISOString() : null,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, travado });
}
