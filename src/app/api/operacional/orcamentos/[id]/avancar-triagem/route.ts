import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";

const STATUS_AG_TRIAGEM = STATUS_OPERACIONAL[1].valor; // "1 - Ag. Triagem"
const STATUS_AG_ANALISE = STATUS_OPERACIONAL[2].valor; // "2 - Ag. Análise"

// Avança um aparelho de Ag. Triagem pra Ag. Análise SEM imprimir etiqueta
// — usado na confirmação em massa (seleção de várias linhas na tabela,
// inclusive "selecionar todos"), já que ali a intenção é só liberar o
// lote pra próxima etapa. A impressão continua acontecendo só no popup
// de bipar um por um (que já existia).
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
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Aparelho não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== STATUS_AG_TRIAGEM) {
    return NextResponse.json(
      { error: "Esse aparelho não está mais em Ag. Triagem (alguém já deve ter mexido nele)." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_AG_ANALISE,
      triagem_concluida_por: user.id,
      triagem_concluida_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
