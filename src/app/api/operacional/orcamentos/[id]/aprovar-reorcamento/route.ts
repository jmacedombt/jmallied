import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_AG_PECAS, STATUS_AG_RESPOSTA_REORCAMENTO } from "@/lib/orcamentos";

// "Aprovar" em "4 - Ag. Resposta de Reorçamento" — ação individual, sem
// trava de cargo (mesmo padrão do Reprovar, que já existe nessa etapa
// desde o início). Só libera pra quem já foi enviado pra Allied
// (reorcamento_enviado_em preenchido) ou chegou por Contra Proposta
// (reorcamento_detalhe vazio — esse caminho já manda a planilha antes
// de chegar aqui, então já está "aguardando aprovação" desde a
// entrada). Avança direto pra "5 - Ag. Peças".
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional, reorcamento_detalhe, reorcamento_enviado_em")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }
  if (atual.status_operacional !== STATUS_AG_RESPOSTA_REORCAMENTO) {
    return NextResponse.json({ error: "Esse orçamento não está em 4 - Ag. Resposta de Reorçamento." }, { status: 409 });
  }
  if (atual.reorcamento_detalhe && !atual.reorcamento_enviado_em) {
    return NextResponse.json(
      { error: "Esse reorçamento ainda não foi enviado pra Allied — envie a planilha Complementar antes de aprovar." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_AG_PECAS,
      aprovado_reorcamento_em: new Date().toISOString(),
      aprovado_reorcamento_por: user.id,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
