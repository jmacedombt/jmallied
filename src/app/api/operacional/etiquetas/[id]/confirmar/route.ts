import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";

const STATUS_AG_TRIAGEM = STATUS_OPERACIONAL[1].valor; // "1 - Ag. Triagem"
const STATUS_AG_ANALISE = STATUS_OPERACIONAL[2].valor; // "2 - Ag. Análise"

// Confirma o resultado real da impressão (o servidor não fala direto com
// o Allied Print Agent — ele roda em localhost, só o navegador do
// operador alcança). Se foi uma bipagem de triagem e deu certo, avança o
// aparelho pra "2 - Ag. Análise" automaticamente.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sucesso = Boolean(body?.sucesso);
  const mensagemErro = body?.mensagem_erro ? String(body.mensagem_erro).slice(0, 500) : null;

  const admin = createAdminClient();

  const { data: log, error: erroLog } = await admin
    .from("etiquetas_impressoes")
    .select("id, tipo, orcamento_id")
    .eq("id", params.id)
    .single();

  if (erroLog || !log) {
    return NextResponse.json({ error: "Registro de bipagem não encontrado." }, { status: 404 });
  }

  await admin
    .from("etiquetas_impressoes")
    .update({ sucesso, mensagem_erro: mensagemErro })
    .eq("id", params.id);

  let novoStatus: string | null = null;

  if (sucesso && log.tipo === "triagem" && log.orcamento_id) {
    const { data: orcamento } = await admin
      .from("orcamentos")
      .select("status_operacional")
      .eq("id", log.orcamento_id)
      .single();

    // só avança se ainda estiver em Ag. Triagem — evita corrida/duplo avanço
    if (orcamento?.status_operacional === STATUS_AG_TRIAGEM) {
      const { data: atualizado, error: erroUpdate } = await admin
        .from("orcamentos")
        .update({
          status_operacional: STATUS_AG_ANALISE,
          triagem_concluida_por: user.id,
          triagem_concluida_em: new Date().toISOString(),
        })
        .eq("id", log.orcamento_id)
        .select("status_operacional")
        .single();

      if (!erroUpdate && atualizado) {
        novoStatus = atualizado.status_operacional;
      }
    }
  }

  return NextResponse.json({ ok: true, novoStatus });
}
