import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { montarPlanilhaOrcamentos } from "@/lib/email";
import { prepararEnvioReorcamento } from "@/lib/reorcamentoEnvio";

export const maxDuration = 60;

// Gera o Excel exatamente como ele sairia se a pessoa clicasse "Enviar
// planilha Complementar" agora — mesmo cálculo, mesma seleção de
// pendentes — mas SEM gravar nem marcar nada como enviado. Só pra
// conferência.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAprovacaoOrcamento(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para ver o preview da planilha Complementar." }, { status: 403 });
  }

  const preparo = await prepararEnvioReorcamento(admin);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro }, { status: preparo.status });
  }

  const planilha = montarPlanilhaOrcamentos(preparo.itens.map((i) => i.linha));

  return new NextResponse(new Uint8Array(planilha), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="preview-complementar.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
