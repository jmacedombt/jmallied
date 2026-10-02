import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Baixa de novo uma planilha "Reorçamento" (Complementar) já enviada —
// diferente de Contra Propostas/Modelo de Retorno, aqui o arquivo real já
// está salvo no Storage (bucket envios-orcamentos, ver persistirEEnviarLote
// em lib/orcamentoEnvio.ts), então é só baixar de novo o mesmo arquivo, em
// vez de remontar a planilha a partir de um snapshot.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAprovacaoOrcamento(perfil) && !isAllied(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra acessar o histórico de Reorçamento." }, { status: 403 });
  }

  const { data: registro, error } = await admin
    .from("orcamento_envios")
    .select("arquivo_path")
    .eq("id", params.id)
    .eq("tipo", "reorcamento")
    .single();

  if (error || !registro) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }
  if (!registro.arquivo_path) {
    return NextResponse.json({ error: "O arquivo não ficou salvo no momento desse envio." }, { status: 404 });
  }

  const { data: arquivo, error: erroStorage } = await admin.storage.from("envios-orcamentos").download(registro.arquivo_path);

  if (erroStorage || !arquivo) {
    return NextResponse.json({ error: "Não foi possível baixar o arquivo salvo." }, { status: 400 });
  }

  const nomeArquivo = registro.arquivo_path.split("/").pop() || "complementar.xlsx";
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
