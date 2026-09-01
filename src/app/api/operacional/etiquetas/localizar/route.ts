import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";

const STATUS_AG_TRIAGEM = STATUS_OPERACIONAL[1].valor; // "1 - Ag. Triagem"

const COLUNAS_ORCAMENTO =
  "id, os_reparadora, nf_remessa_allied, os_care_allied, trade_allied, imei_allied, modelo_comercial, sku, descricao_completa, status_operacional, os_reparadora_definida_em, updated_at";

// Localiza um aparelho pelo código bipado (Trade Allied) — restrito à
// lista de Ag. Triagem (modo "triagem") ou em toda a base de orçamentos
// (modo "avulsa"). Sempre grava uma linha em etiquetas_impressoes, que a
// tela confirma depois (rota .../[id]/confirmar) com o resultado real da
// impressão no Allied Print Agent.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const codigo = String(body?.codigo ?? "").trim();
  const tipo = body?.tipo === "avulsa" ? "avulsa" : "triagem";

  if (!codigo) {
    return NextResponse.json({ error: "Informe o código bipado." }, { status: 400 });
  }

  const admin = createAdminClient();

  let query = admin.from("orcamentos").select(COLUNAS_ORCAMENTO).eq("trade_allied", codigo);
  if (tipo === "triagem") {
    query = query.eq("status_operacional", STATUS_AG_TRIAGEM);
  }

  // Trade Allied pode se repetir entre NFs diferentes (reincidência) —
  // em caso de mais de um resultado, usa sempre o mais recente.
  const { data: orcamento } = await query
    .order(tipo === "triagem" ? "os_reparadora_definida_em" : "updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const encontrado = Boolean(orcamento);

  const { data: log, error: erroLog } = await admin
    .from("etiquetas_impressoes")
    .insert({
      orcamento_id: orcamento?.id ?? null,
      tipo,
      codigo_bipado: codigo,
      encontrado,
      sucesso: false,
      impresso_por: user.id,
    })
    .select("id")
    .single();

  if (erroLog || !log) {
    return NextResponse.json({ error: erroLog?.message || "Não consegui registrar a bipagem." }, { status: 400 });
  }

  return NextResponse.json({
    logId: log.id,
    encontrado,
    orcamento: orcamento ?? null,
  });
}
