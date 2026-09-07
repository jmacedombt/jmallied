import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { montarPlanilhaOrcamentos } from "@/lib/email";
import { prepararEnvioLote } from "@/lib/validacaoEnvioAllied";

export const maxDuration = 60;

// Gera o Excel exatamente como ele sairia se a pessoa clicasse
// "Confirmar" agora — mesma trava, mesmo cálculo (ver
// lib/validacaoEnvioAllied.ts) — mas SEM gravar nada no banco: nenhum
// orçamento avança de etapa, nenhum snapshot é congelado, nenhum e-mail
// é disparado. Só pra conferência antes de confirmar de verdade.
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
      { error: "Seu cargo não tem permissão para ver o preview do envio de um lote." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const nfRemessa = String(body?.nf_remessa_allied ?? "").trim();

  if (!nfRemessa) {
    return NextResponse.json({ error: "Selecione um lote (NF Remessa)." }, { status: 400 });
  }

  const preparo = await prepararEnvioLote(admin, nfRemessa);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro, pecasDesatualizadas: preparo.pecasDesatualizadas }, { status: preparo.status });
  }

  const linhasPlanilha = [...preparo.itensConfirmaveis.map((i) => i.linha), ...preparo.linhasReprovados];
  const planilha = montarPlanilhaOrcamentos(linhasPlanilha);

  return new NextResponse(new Uint8Array(planilha), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="preview-orcamentos-${nfRemessa}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
