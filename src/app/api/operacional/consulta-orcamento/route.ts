import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConsultarOrcamento } from "@/lib/usuarios";

const LIMITE_RESULTADOS = 30;

/** Tira "%", "_" (curingas do ILIKE) e "," (separador do .or() do
 * Supabase) do termo digitado — evita tanto o termo virar um curinga
 * sem querer quanto quebrar a query em si. */
function limparTermoBusca(valor: string): string {
  return valor.trim().replace(/[%_,]/g, "");
}

// Busca um orçamento por OS Reparadora, OS Care Allied ou Trade Allied
// (pedido explícito, "Consulta/Alteração", migration 0070) — um campo
// só, aceita qualquer um dos 3 (bate parcial, sem diferenciar
// maiúscula/minúscula). Visível pra qualquer login com acesso normal ao
// Operacional, inclusive ALLIED (ver podeConsultarOrcamento).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConsultarOrcamento(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra acessar essa tela." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const termo = limparTermoBusca(searchParams.get("busca") ?? "");

  if (termo.length < 2) {
    return NextResponse.json({ error: "Digite ao menos 2 caracteres pra buscar." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("orcamentos")
    .select("id, trade_allied, os_care_allied, os_reparadora, modelo_comercial, status_operacional")
    .or(`os_reparadora.ilike.%${termo}%,os_care_allied.ilike.%${termo}%,trade_allied.ilike.%${termo}%`)
    .order("updated_at", { ascending: false })
    .limit(LIMITE_RESULTADOS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ resultados: data ?? [] });
}
