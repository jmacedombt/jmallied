import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";

// Grava/atualiza o override de Faixas de Markup de UM lote (NF Remessa) —
// botão "Utilizar nova margem" dentro do pop-up "Resumo de Peças" em
// Validação de Orçamentos (ver PopupResumoPecasMarkup.tsx e migration
// 0050). A partir daqui, TODO cálculo de peças desse lote em Validação
// de Orçamentos (tela ao vivo, Recalcular, e o congelado de Confirmar
// Envio) passa a usar essas faixas em vez da faixa global de
// Configurações — até alguém sobrescrever de novo. Outros lotes
// continuam na faixa global normalmente.
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

  // mesma permissão de "Confirmar Envio" nessa tela — quem pode confirmar
  // o envio de um lote também pode fixar a margem customizada dele.
  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra definir uma margem customizada." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nfRemessa = typeof body?.nfRemessa === "string" ? body.nfRemessa.trim() : "";
  const faixas = Array.isArray(body?.faixas) ? (body.faixas as FaixaMarkup[]) : null;

  if (!nfRemessa) {
    return NextResponse.json({ error: "Selecione um lote específico antes de aplicar essa margem." }, { status: 400 });
  }
  if (!faixas || faixas.length === 0 || faixas.some((f) => !Number.isFinite(f.multiplicador) || f.multiplicador <= 0)) {
    return NextResponse.json({ error: "Faixas de markup inválidas." }, { status: 400 });
  }

  const { error } = await admin.from("orcamentos_lote_markup_override").upsert(
    {
      nf_remessa_allied: nfRemessa,
      faixas,
      definido_por: user.id,
      definido_em: new Date().toISOString(),
    },
    { onConflict: "nf_remessa_allied" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
