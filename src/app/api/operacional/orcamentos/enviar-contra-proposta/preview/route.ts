import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { montarPlanilhaOrcamentos } from "@/lib/email";
import { prepararEnvioContraProposta } from "@/lib/contraProposta";

export const maxDuration = 60;

// Gera o Excel exatamente como ele sairia se a pessoa clicasse "Enviar
// Contra Proposta" agora — mesma trava (todos ajustados), mesmo cálculo
// — mas SEM gravar nem mover de etapa nada. Só pra conferência.
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

  if (!podeConfirmarAprovacaoOrcamento(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para ver o preview da Contra Proposta." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nfRemessa = String(body?.nf_remessa_allied ?? "").trim();
  if (!nfRemessa) {
    return NextResponse.json({ error: "Selecione um lote (NF Remessa)." }, { status: 400 });
  }

  const preparo = await prepararEnvioContraProposta(admin, nfRemessa);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro }, { status: preparo.status });
  }

  const planilha = montarPlanilhaOrcamentos(preparo.itens.map((i) => i.linha));

  return new NextResponse(new Uint8Array(planilha), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="preview-contra-proposta-${nfRemessa}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
