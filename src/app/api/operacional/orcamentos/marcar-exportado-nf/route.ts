import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeLancarNfProdutoEntregue } from "@/lib/orcamentos";

// Marca `nf_exportado_em` nos aparelhos de um lote (NF Remessa) assim
// que o botão "Exportar" é clicado e a planilha é gerada, dentro de
// "Ag. Emissão de Nota Fiscal" (Aprovados ou Recusados) — é o que
// libera o lançamento das NFs daquele lote (ver PainelAgEmissaoNf.tsx e
// migration 0048). Não muda status_operacional nem nenhum outro campo.
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

  if (!podeLancarNfProdutoEntregue(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra lançar NF nessa tela." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhum aparelho informado." }, { status: 400 });
  }

  const { error } = await admin.from("orcamentos").update({ nf_exportado_em: new Date().toISOString() }).in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
