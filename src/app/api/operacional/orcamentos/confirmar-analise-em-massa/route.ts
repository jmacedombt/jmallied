import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_AG_ANALISE, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// Confirma "Análise realizada" em lote pra vários aparelhos de uma vez
// (seleção múltipla em Ag. Análise) — só visível/liberado pra
// Supervisor, Gerente ou Administrador (ver podeConfirmarAnaliseEmLote).
// Só mexe nos que ainda estiverem em "2 - Ag. Análise" (o filtro
// .eq("status_operacional", ...) evita reprocessar um aparelho que
// alguém já confirmou individualmente entre a seleção e o clique).
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

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão pra confirmar análises em lote." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  const agora = new Date().toISOString();
  let confirmados = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .update({
        status_operacional: STATUS_VALIDACAO_ORCAMENTOS,
        analise_confirmada_por: user.id,
        analise_confirmada_em: agora,
      })
      .in("id", lote)
      .eq("status_operacional", STATUS_AG_ANALISE)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    confirmados += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, confirmados });
}
