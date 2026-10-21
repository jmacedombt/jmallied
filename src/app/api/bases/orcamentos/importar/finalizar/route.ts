import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarOrcamentos } from "@/lib/orcamentos";

// Fecha a importação da Base de Orçamentos (pedido explícito,
// 21/10/2026) — preenche os números do histórico (Novos, Duplicados,
// RRR, Modelos, SKUs) depois que todos os pacotes foram gravados (ver
// importar/lote). Novos e RRR são contados direto no banco por TODOS os
// aparelhos da NF Remessa do lote, não pelo que a tela informou.
export const maxDuration = 15;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para importar a base de orçamentos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const loteId = typeof body?.loteId === "string" ? body.loteId : null;
  const linhasValidas = Number(body?.linhasValidas ?? 0);
  const modelos = Number(body?.modelosComerciaisUnicos ?? 0);
  const skus = Number(body?.skusUnicos ?? 0);
  if (!loteId) return NextResponse.json({ error: "Importação não informada." }, { status: 400 });

  // conta TODOS os aparelhos da NF Remessa desse lote (uma NF = uma
  // linha no histórico, mesmo que tenha entrado em mais de uma subida).
  const { data: lote } = await admin.from("orcamentos_lotes").select("nf_remessa_allied").eq("id", loteId).single();
  if (!lote) return NextResponse.json({ error: "Importação não encontrada." }, { status: 404 });

  const [{ count: novos }, { count: reincidentes }] = await Promise.all([
    admin.from("orcamentos").select("id", { count: "exact", head: true }).eq("nf_remessa_allied", lote.nf_remessa_allied),
    admin
      .from("orcamentos")
      .select("id", { count: "exact", head: true })
      .eq("nf_remessa_allied", lote.nf_remessa_allied)
      .eq("reincidente", true),
  ]);

  const aparelhosNovosInseridos = novos ?? 0;
  const aparelhosReincidentes = reincidentes ?? 0;
  const aparelhosDuplicadosIgnorados = Math.max(0, linhasValidas - aparelhosNovosInseridos);

  const { error } = await admin
    .from("orcamentos_lotes")
    .update({
      aparelhos_novos_inseridos: aparelhosNovosInseridos,
      aparelhos_duplicados_ignorados: aparelhosDuplicadosIgnorados,
      aparelhos_reincidentes: aparelhosReincidentes,
      modelos_comerciais_unicos: Number.isFinite(modelos) ? modelos : 0,
      skus_unicos: Number.isFinite(skus) ? skus : 0,
    })
    .eq("id", loteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ aparelhosNovosInseridos, aparelhosDuplicadosIgnorados, aparelhosReincidentes });
}
