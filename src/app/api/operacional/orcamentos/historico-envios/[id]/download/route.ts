import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Baixa de novo o Excel de um envio já confirmado (clique num item do
// pop-up de Histórico) — o mesmo arquivo que foi gerado e mandado por
// e-mail na hora do envio, agora persistido no bucket envios-orcamentos
// (ver lib/orcamentoEnvio.ts).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: envio, error: erroEnvio } = await admin
    .from("orcamento_envios")
    .select("arquivo_path, nf_remessa_allied, tipo")
    .eq("id", params.id)
    .single();

  if (erroEnvio || !envio) {
    return NextResponse.json({ error: "Envio não encontrado." }, { status: 404 });
  }
  if (!envio.arquivo_path) {
    return NextResponse.json(
      { error: "O arquivo desse envio não ficou salvo (falha no momento do envio) — não é possível baixar de novo." },
      { status: 404 }
    );
  }

  const { data: arquivo, error: erroDownload } = await admin.storage.from("envios-orcamentos").download(envio.arquivo_path);
  if (erroDownload || !arquivo) {
    return NextResponse.json({ error: "Não consegui recuperar o arquivo desse envio." }, { status: 404 });
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const prefixo = envio.tipo === "contra_proposta" ? "contra-proposta" : "orcamentos";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${prefixo}-${envio.nf_remessa_allied}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
