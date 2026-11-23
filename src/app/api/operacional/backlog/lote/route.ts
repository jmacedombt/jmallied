import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Backlog > clique no lote / no número pendente (pedido explícito,
// 23/11/2026): lista os aparelhos PENDENTES do lote (tudo que ainda não
// está em Produto Entregue — mesma regra da migration 0087). Só leitura,
// sem custo/BID. Liberado também pro cargo ALLIED (middleware.ts), igual
// ao "Exportar backlog".
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const nf = (new URL(request.url).searchParams.get("nf") ?? "").trim();
  if (!nf) return NextResponse.json({ error: "Informe o lote (NF Remessa)." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orcamentos")
    .select("id, trade_allied, os_reparadora, os_care_allied, imei_allied, modelo_comercial, status_operacional, data_reconhecimento")
    .eq("nf_remessa_allied", nf)
    .neq("status_operacional", "Produto Entregue")
    .order("status_operacional", { ascending: true })
    .order("trade_allied", { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: "Não consegui buscar as pendências desse lote." }, { status: 500 });
  return NextResponse.json({ aparelhos: data ?? [] });
}
