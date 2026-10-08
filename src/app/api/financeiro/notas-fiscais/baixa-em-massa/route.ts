import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeAcessarFinanceiro, hojeIso, type TipoNotaFinanceiro } from "@/lib/financeiro";

// Baixa em massa (pedido explícito, 07/10/2026): marca várias notas
// fiscais de uma vez como "Vlr. Recebido", com a mesma data de
// recebimento. Cada nota é identificada pelo lançamento + tipo (Mão de
// Obra ou Peças) — mesma regra da baixa individual em [id]/route.ts.
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

  if (!podeAcessarFinanceiro(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem acesso ao Financeiro." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const notas = Array.isArray(body?.notas) ? (body.notas as { id?: unknown; tipo?: unknown }[]) : [];
  const dataRecebimento = String(body?.data_recebimento ?? "").trim() || hojeIso();

  const validas = notas.filter(
    (n): n is { id: string; tipo: TipoNotaFinanceiro } =>
      typeof n?.id === "string" && (n.tipo === "mao_de_obra" || n.tipo === "pecas")
  );
  if (validas.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos uma nota fiscal." }, { status: 400 });
  }

  const agora = new Date().toISOString();
  for (const n of validas) {
    const { error } = await admin
      .from("financeiro_notas_fiscais")
      .update({
        [`nf_${n.tipo}_status`]: "Vlr. Recebido",
        [`nf_${n.tipo}_data_recebimento`]: dataRecebimento,
        atualizado_por: user.id,
        atualizado_em: agora,
      })
      .eq("id", n.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, quantidade: validas.length });
}
