import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_AG_ANALISE, STATUS_ORCAMENTO_REPROVADO } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// Recusa vários orçamentos de uma vez (seleção múltipla em 2 - Ag.
// Análise) — mesma permissão de "Confirmar Análise realizada em lote"
// (podeConfirmarAnaliseEmLote). Só mexe nos que ainda estiverem em
// "2 - Ag. Análise" (evita reprocessar um orçamento que alguém já mexeu
// individualmente entre a seleção e o clique) e grava a MESMA
// justificativa em todos.
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
    return NextResponse.json({ error: "Seu cargo não tem permissão pra recusar orçamentos em lote." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  const motivo = String(body?.motivo_reprova ?? "").trim();

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um orçamento." }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "Informe a justificativa da reprovação." }, { status: 400 });
  }

  const agora = new Date().toISOString();
  let reprovados = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .update({
        status_operacional: STATUS_ORCAMENTO_REPROVADO,
        motivo_reprova: motivo,
        reprovado_por: user.id,
        reprovado_em: agora,
      })
      .in("id", lote)
      .eq("status_operacional", STATUS_AG_ANALISE)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    reprovados += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, reprovados });
}
