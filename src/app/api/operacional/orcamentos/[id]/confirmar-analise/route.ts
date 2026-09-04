import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_ANALISE, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

// Confirma que a análise de um aparelho ("2 - Ag. Análise") foi
// realizada pelo técnico, avançando o orçamento pra "Validação de
// Orçamentos" — botão de check na tela de Ag. Análise (ver
// PainelAgAnalise.tsx).
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

  if (atual.status_operacional !== STATUS_AG_ANALISE) {
    return NextResponse.json(
      { error: "Esse aparelho não está mais em Ag. Análise (alguém já deve ter mexido nele)." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_VALIDACAO_ORCAMENTOS,
      analise_confirmada_por: user.id,
      analise_confirmada_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
