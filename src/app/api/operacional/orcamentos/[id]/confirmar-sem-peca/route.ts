import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

// Confirma que um aparelho em Validação de Orçamentos realmente vai
// seguir sem nenhuma peça lançada (só mão de obra) — aberto a partir do
// pop-up de peças, depois que o usuário revisou e constatou que não tem
// peça mesmo. Enquanto não confirmado, o lote inteiro fica bloqueado
// pra avançar (ver avancar-validacao-em-massa).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para confirmar aparelho sem peça." },
      { status: 403 }
    );
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select(`status_operacional, ${COLUNAS_PECAS}`)
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Aparelho não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== STATUS_VALIDACAO_ORCAMENTOS) {
    return NextResponse.json({ error: "Esse aparelho não está mais em Validação de Orçamentos." }, { status: 409 });
  }

  const temAlgumaPeca = [
    atual.peca_1, atual.peca_2, atual.peca_3, atual.peca_4, atual.peca_5,
    atual.peca_6, atual.peca_7, atual.peca_8, atual.peca_9, atual.peca_10,
    atual.peca_add_1, atual.peca_add_2, atual.peca_add_3, atual.peca_add_4, atual.peca_add_5,
  ].some((p) => p && String(p).trim());

  if (temAlgumaPeca) {
    return NextResponse.json(
      { error: "Esse orçamento já tem peça lançada — a confirmação é só pra aparelhos sem nenhuma peça." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      validacao_confirmado_sem_peca: true,
      validacao_confirmado_sem_peca_por: user.id,
      validacao_confirmado_sem_peca_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
