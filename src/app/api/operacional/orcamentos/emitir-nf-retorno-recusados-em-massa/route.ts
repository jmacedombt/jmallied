import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeEmitirNfEmLote, STATUS_ORCAMENTO_REPROVADO, STATUS_AG_NF_RETORNO_RECUSADOS } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// "Emitir NF - Envio de Pré Ordem" em "8 - Orçamento Reprovado" — move
// em lote pra "Ag. Emissão de Nota Fiscal" com o status
// "Ag. NF Retorno (Recusados)" (ver PainelOrcamentoReprovado.tsx e o
// pop-up PopupBipagemSelecao.tsx). Só mexe nos que ainda estiverem em
// "8 - Orçamento Reprovado" (evita reprocessar um aparelho que alguém
// já moveu entre a seleção e o clique).
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

  if (!podeEmitirNfEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra emitir NF em lote." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  let movidos = 0;

  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .update({ status_operacional: STATUS_AG_NF_RETORNO_RECUSADOS })
      .in("id", lote)
      .eq("status_operacional", STATUS_ORCAMENTO_REPROVADO)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    movidos += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, movidos });
}
