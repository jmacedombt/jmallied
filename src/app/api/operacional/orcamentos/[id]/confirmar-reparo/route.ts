import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_REPARO, STATUS_OQC } from "@/lib/orcamentos";

// Confirma que o reparo de um aparelho ("6 - Ag. Reparo") foi realizado
// pelo técnico, avançando o orçamento pra "OQC - Controle de Qualidade"
// — botão "Reparado" na tela (ver PainelAgReparo.tsx).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Aparelho não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== STATUS_AG_REPARO) {
    return NextResponse.json(
      { error: "Esse aparelho não está mais em 6 - Ag. Reparo (alguém já deve ter mexido nele)." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_OQC,
      reparo_confirmado_por: user.id,
      reparo_confirmado_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
