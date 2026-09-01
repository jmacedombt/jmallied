import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

function validarFaixa(body: unknown): { valor_min: number; valor_max: number | null; multiplicador: number } | null {
  const b = body as Record<string, unknown>;
  const valorMin = Number(b.valor_min);
  const valorMax = b.valor_max === null || b.valor_max === "" || b.valor_max === undefined ? null : Number(b.valor_max);
  const multiplicador = Number(b.multiplicador);

  if (!Number.isFinite(valorMin) || valorMin < 0) return null;
  if (valorMax !== null && (!Number.isFinite(valorMax) || valorMax <= valorMin)) return null;
  if (!Number.isFinite(multiplicador) || multiplicador <= 0) return null;

  return { valor_min: valorMin, valor_max: valorMax, multiplicador };
}

// Cria uma nova faixa de markup (Configurações > Faixas de Markup BID).
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

  if (!podeImportarBid(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para alterar essa configuração." }, { status: 403 });
  }

  const body = await request.json();
  const faixa = validarFaixa(body);

  if (!faixa) {
    return NextResponse.json(
      { error: "Confira os valores: mínimo ≥ 0, máximo maior que o mínimo (ou vazio para \"acima de\"), multiplicador > 0." },
      { status: 400 }
    );
  }

  const { data: ultima } = await admin
    .from("configuracoes_bid_markup")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await admin
    .from("configuracoes_bid_markup")
    .insert({ ...faixa, ordem: (ultima?.ordem ?? 0) + 1, atualizado_por: user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
