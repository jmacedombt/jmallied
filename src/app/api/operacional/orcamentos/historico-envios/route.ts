import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Lista o histórico de envios confirmados (botão "Histórico" em
// Validação de Orçamentos) — por padrão só os de tipo "orcamento"
// (Confirmar Envio); filtra por NF Remessa quando informado. Qualquer
// usuário autenticado pode ver (mesma trava de leitura que o resto do
// Operacional) — só o download do arquivo em si não precisa de trava
// extra, já que é o mesmo Excel que já foi mandado por e-mail.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") || "orcamento";
  const nf = searchParams.get("nf")?.trim();

  const admin = createAdminClient();
  let query = admin
    .from("orcamento_envios")
    .select("id, tipo, nf_remessa_allied, quantidade_aparelhos, arquivo_path, enviado_em, email_enviado, email_erro, usuarios:enviado_por (nome, sobrenome)")
    .eq("tipo", tipo)
    .order("enviado_em", { ascending: false })
    .limit(100);

  if (nf) query = query.ilike("nf_remessa_allied", `%${nf}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ envios: data ?? [] });
}
