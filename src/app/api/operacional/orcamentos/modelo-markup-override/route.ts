import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";

// Grava/atualiza o override de multiplicador de Markup por MODELO + Peça
// — botão "Aplicar" dentro do pop-up "Resumo de Peças por Modelo" em
// Validação de Orçamentos (ver PopupResumoPecasModelo.tsx e migration
// 0072). Recebe o multiplicador simulado ATUAL de cada código de peça
// daquele modelo (seja o valor aplicado em massa no campo do modelo, seja
// ajustado peça a peça) e grava um registro por (modelo_comercial,
// codigo) de uma vez só. A partir daqui, todo cálculo de peças dessa
// combinação em Validação de Orçamentos passa a usar esse multiplicador
// em vez da Faixa de Markup (global ou por lote) — até alguém sobrescrever
// de novo (ver calcularDetalheValidacao em lib/orcamentos.ts).
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

  // mesma permissão de "Confirmar Envio"/"Utilizar nova margem" nessa tela.
  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra definir uma margem customizada." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const modeloComercial = typeof body?.modeloComercial === "string" ? body.modeloComercial.trim() : "";
  const pecas = Array.isArray(body?.pecas) ? (body.pecas as { codigo?: unknown; multiplicador?: unknown }[]) : null;

  if (!modeloComercial) {
    return NextResponse.json({ error: "Modelo comercial inválido." }, { status: 400 });
  }
  if (!pecas || pecas.length === 0) {
    return NextResponse.json({ error: "Nenhuma peça pra aplicar a margem." }, { status: 400 });
  }

  const linhas: { modelo_comercial: string; codigo: string; multiplicador: number; definido_por: string; definido_em: string }[] = [];
  const agora = new Date().toISOString();
  for (const p of pecas) {
    const codigo = typeof p.codigo === "string" ? p.codigo.trim() : "";
    const multiplicador = Number(p.multiplicador);
    if (!codigo || !Number.isFinite(multiplicador) || multiplicador <= 0) {
      return NextResponse.json({ error: "Multiplicador inválido pra alguma peça desse modelo." }, { status: 400 });
    }
    linhas.push({ modelo_comercial: modeloComercial, codigo, multiplicador, definido_por: user.id, definido_em: agora });
  }

  const { error } = await admin
    .from("orcamentos_modelo_peca_markup_override")
    .upsert(linhas, { onConflict: "modelo_comercial,codigo" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
