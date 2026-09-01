import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { osReparadoraValida, STATUS_OPERACIONAL } from "@/lib/orcamentos";

const STATUS_AG_ABERTURA = STATUS_OPERACIONAL[0].valor; // "Ag. Abertura"
const STATUS_AG_TRIAGEM = STATUS_OPERACIONAL[1].valor; // "1 - Ag. Triagem"

// Registra, corrige ou apaga a OS Reparadora de um aparelho.
// - Valor válido (10 números): grava a OS Reparadora. Se o aparelho ainda
//   estava em "Ag. Abertura", avança para "1 - Ag. Triagem"; se já estava
//   em uma etapa mais adiantada (edição feita pelo lápis), só corrige o
//   número e mantém a etapa atual.
// - Valor vazio: apaga a OS Reparadora e devolve o aparelho para
//   "Ag. Abertura", pra equipe reabrir o registro do zero.
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
  const admin = createAdminClient();

  if (osReparadora === "") {
    const { data, error } = await admin
      .from("orcamentos")
      .update({
        os_reparadora: null,
        status_operacional: STATUS_AG_ABERTURA,
        os_reparadora_definida_por: null,
        os_reparadora_definida_em: null,
      })
      .eq("id", params.id)
      .select("id, os_reparadora, status_operacional")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  }

  if (!osReparadoraValida(osReparadora)) {
    return NextResponse.json(
      { error: "A OS Reparadora deve ter exatamente 10 números." },
      { status: 400 }
    );
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Aparelho não encontrado." }, { status: 404 });
  }

  const novoStatus = atual.status_operacional === STATUS_AG_ABERTURA ? STATUS_AG_TRIAGEM : atual.status_operacional;

  const { data, error } = await admin
    .from("orcamentos")
    .update({
      os_reparadora: osReparadora,
      status_operacional: novoStatus,
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
