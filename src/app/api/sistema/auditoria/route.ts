import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/** Retenção de 60 dias (pedido explícito) — mesmo princípio já usado em
 * modelo_retorno_geracoes/chat_mensagens: sem cron nenhum, só um filtro
 * de data na consulta. */
const RETENCAO_DIAS = 60;

function corteRetencaoIso(): string {
  return new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

// Lista as alterações feitas em "Consulta/Alteração" (menu Sistema >
// Auditoria, migration 0070) — só os últimos 60 dias, mais recente
// primeiro. Só pro Administrador (is_master) — nem Supervisor/Gerente,
// que já podem fazer a alteração em si, veem esse histórico (pedido
// explícito: mais restrito de propósito).
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("is_master").eq("id", user.id).single();

  if (!perfil?.is_master) {
    return NextResponse.json({ error: "Só o Administrador pode acessar a Auditoria." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("orcamento_auditoria")
    .select(
      "id, orcamento_id, trade_allied, os_care_allied, os_reparadora_anterior, os_reparadora_nova, alterado_em, usuarios:alterado_por (nome, sobrenome)"
    )
    .gte("alterado_em", corteRetencaoIso())
    .order("alterado_em", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ registros: data ?? [] });
}
