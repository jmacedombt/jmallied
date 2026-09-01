import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { osReparadoraValida, STATUS_OPERACIONAL } from "@/lib/orcamentos";

const PROXIMO_STATUS = STATUS_OPERACIONAL[1].valor; // "1 - Ag. Triagem"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const osReparadora = String(body.os_reparadora ?? "").trim();

  if (!osReparadoraValida(osReparadora)) {
    return NextResponse.json(
      { error: "A OS Reparadora deve ter exatamente 10 números." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("orcamentos")
    .update({
      os_reparadora: osReparadora,
      status_operacional: PROXIMO_STATUS,
      os_reparadora_definida_por: user.id,
      os_reparadora_definida_em: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("id, os_reparadora, status_operacional")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Essa OS Reparadora já está registrada em outro aparelho." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
