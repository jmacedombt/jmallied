import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Lista o histórico de planilhas "Reorçamento" (Complementar) já enviadas
// (menu Operacional > Reorçamento, pedido explícito, 02/10/2026) — mais
// recente primeiro, sem limite de retenção (mesmo critério de Contra
// Propostas). Reaproveita o registro que já existe em orcamento_envios
// (tipo "reorcamento" — ver lib/orcamentoEnvio.ts, persistirEEnviarLote,
// chamado dentro de enviar-reorcamento/route.ts), por isso não existe um
// POST manual de "registrar envio" aqui — o registro já é automático.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  // ALLIED também pode ver o histórico (pedido explícito) — mesma regra
  // de Contra Propostas.
  if (!podeConfirmarAprovacaoOrcamento(perfil) && !isAllied(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra acessar o histórico de Reorçamento." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("orcamento_envios")
    .select("id, nf_remessa_allied, quantidade_aparelhos, arquivo_path, enviado_em, usuarios:enviado_por (nome, sobrenome)")
    .eq("tipo", "reorcamento")
    .order("enviado_em", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ envios: data ?? [] });
}
