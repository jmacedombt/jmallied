import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

// Flag RRR - Reincidência em Validação de Orçamentos (migration 0083).
// Com a flag ativa a Mão de Obra não é cobrada (fica R$ 0,00). Por padrão
// segue `orcamentos.reincidente` (marcado na importação); aqui dá pra
// ligar/desligar à mão — sem justificativa, só registra quem e quando.
// Corpo: { ativo: boolean }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra alterar a flag RRR." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.ativo !== "boolean") {
    return NextResponse.json({ error: "Informe se a flag RRR fica ativa ou não." }, { status: 400 });
  }

  const { data: atual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();
  if (!atual) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  if (atual.status_operacional !== STATUS_VALIDACAO_ORCAMENTOS) {
    return NextResponse.json(
      { error: "Esse orçamento não está mais em Validação de Orçamentos — atualize a tela." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      validacao_rrr: body.ativo,
      validacao_rrr_alterado_por: user.id,
      validacao_rrr_alterado_em: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
