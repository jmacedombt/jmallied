import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Baixa de novo o arquivo original que a Allied mandou (clique num item
// do histórico de "Validação de Orçamento (Allied)") — mesmo arquivo
// subido em "3 - Ag. Resposta de Orçamento" > Upload (aprovação de
// orçamentos), salvo em storage (bucket aprovacoes-orcamentos).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: registro, error: erroRegistro } = await admin
    .from("orcamento_aprovacoes_uploads")
    .select("arquivo_path, nome_arquivo")
    .eq("id", params.id)
    .single();

  if (erroRegistro || !registro) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }
  if (!registro.arquivo_path) {
    return NextResponse.json(
      { error: "O arquivo desse upload não ficou salvo (falha no momento do envio) — não é possível baixar de novo." },
      { status: 404 }
    );
  }

  const { data: arquivo, error: erroDownload } = await admin.storage
    .from("aprovacoes-orcamentos")
    .download(registro.arquivo_path);
  if (erroDownload || !arquivo) {
    return NextResponse.json({ error: "Não consegui recuperar o arquivo desse upload." }, { status: 404 });
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${registro.nome_arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
