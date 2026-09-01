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

async function checarPermissao() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado." };

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeImportarBid(perfil)) {
    return { ok: false as const, status: 403, error: "Seu cargo não tem permissão para alterar essa configuração." };
  }
  return { ok: true as const, admin, userId: user.id };
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const permissao = await checarPermissao();
  if (!permissao.ok) return NextResponse.json({ error: permissao.error }, { status: permissao.status });

  const body = await request.json();
  const faixa = validarFaixa(body);

  if (!faixa) {
    return NextResponse.json(
      { error: "Confira os valores: mínimo ≥ 0, máximo maior que o mínimo (ou vazio para \"acima de\"), multiplicador > 0." },
      { status: 400 }
    );
  }

  const { data, error } = await permissao.admin
    .from("configuracoes_bid_markup")
    .update({ ...faixa, atualizado_por: permissao.userId, atualizado_em: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const permissao = await checarPermissao();
  if (!permissao.ok) return NextResponse.json({ error: permissao.error }, { status: permissao.status });

  const { error } = await permissao.admin.from("configuracoes_bid_markup").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
