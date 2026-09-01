import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarOrcamentos } from "@/lib/orcamentos";

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

// Grava (ou apaga) a Data Reconhecimento de um lote inteiro e replica o
// valor pra todos os aparelhos daquele lote (orcamentos.lote_id = id).
// Mesma restrição de cargo de quem pode importar a base de orçamentos.
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

  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para definir a Data Reconhecimento." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const dataReconhecimento = String(body.data_reconhecimento ?? "").trim();
  const limpando = dataReconhecimento === "";

  if (!limpando && !DATA_VALIDA.test(dataReconhecimento)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const { data: lote, error: erroLote } = await admin
    .from("orcamentos_lotes")
    .update({
      data_reconhecimento: limpando ? null : dataReconhecimento,
      reconhecimento_definido_por: limpando ? null : user.id,
      reconhecimento_definido_em: limpando ? null : new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("id, nf_remessa_allied, data_reconhecimento")
    .single();

  if (erroLote || !lote) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }

  const { data: aparelhosAtualizados, error: erroAparelhos } = await admin
    .from("orcamentos")
    .update({ data_reconhecimento: limpando ? null : dataReconhecimento })
    .eq("lote_id", params.id)
    .select("id");

  if (erroAparelhos) {
    return NextResponse.json({ error: erroAparelhos.message }, { status: 400 });
  }

  return NextResponse.json({
    lote,
    aparelhos_atualizados: aparelhosAtualizados?.length ?? 0,
  });
}
