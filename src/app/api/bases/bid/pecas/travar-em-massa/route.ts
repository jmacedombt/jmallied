import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

const TAMANHO_LOTE = 400;

// Trava/destrava várias peças do BID de uma vez (seleção em massa na
// Consulta BID).
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

  if (!podeImportarBid(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para travar/destravar peças do BID." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  const travado = Boolean(body?.travado);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma peça." }, { status: 400 });
  }

  const agora = new Date().toISOString();

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { error } = await admin
      .from("bid_pecas")
      .update({
        travado,
        travado_por: travado ? user.id : null,
        travado_em: travado ? agora : null,
      })
      .in("id", lote);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, travado, quantidade: ids.length });
}
