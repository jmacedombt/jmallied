import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

// Marca (ou desmarca, revertendo) UMA versão específica do histórico do
// Relatório BID como "enviada ao cliente" (pedido explícito) — ação
// separada do botão "Marcar BID como enviado" que já existe na mesma
// tela (esse trava, peça a peça, o Custo Peça Allied atual pra fins de
// reconciliação; ver migration 0018). Aqui é só um carimbo nessa LINHA
// do histórico: a partir do momento que enviado_em fica preenchido, essa
// versão passa a aparecer pro login ALLIED (ver
// bid_relatorio_log_allied_listar, migration 0056).
export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão pra marcar o Relatório BID como enviado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const enviado = body?.enviado !== false;

  const atualizacoes = enviado
    ? { enviado_em: new Date().toISOString(), enviado_por: user.id }
    : { enviado_em: null, enviado_por: null };

  const { data: registro, error } = await admin
    .from("bid_relatorio_log")
    .update(atualizacoes)
    .eq("id", params.id)
    .select("id, enviado_em")
    .single();

  if (error || !registro) {
    return NextResponse.json({ error: error?.message ?? "Registro não encontrado." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, enviadoEm: registro.enviado_em });
}
