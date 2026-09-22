import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento, STATUS_AG_CONTRA_PROPOSTA, type PecaContraProposta } from "@/lib/orcamentos";

// Decisão (Aprovado/Reprovado) de um item de Ag. Contra Proposta — chamada
// tanto pelos botões da lista (PainelContraProposta.tsx, com os valores
// "efetivos" do aparelho) quanto do pop-up de ajuste (PopupPecasContraProposta.tsx,
// com os valores que estiverem no formulário na hora). Substitui/estende
// ajustar-contra-proposta: Aprovado grava as peças/mão de obra do
// mesmo jeito (pedido explícito: "ao clicar no aprovado o sistema grava
// as alterações") e além disso registra a decisão; Reprovado só grava a
// decisão + motivo, sem tocar nas peças/mão de obra (a planilha final usa
// sempre o valor ORIGINAL — validacao_snapshot — pra quem foi recusado).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAprovacaoOrcamento(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para decidir a Contra Proposta." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const decisao = body?.decisao;
  if (decisao !== "Aprovado" && decisao !== "Reprovado") {
    return NextResponse.json({ error: "Decisão inválida — use Aprovado ou Reprovado." }, { status: 400 });
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }
  if (atual.status_operacional !== STATUS_AG_CONTRA_PROPOSTA) {
    return NextResponse.json({ error: "Esse orçamento não está em Ag. Contra Proposta." }, { status: 409 });
  }

  const agora = new Date().toISOString();

  if (decisao === "Aprovado") {
    const pecas = body?.pecas;
    const maoDeObra = Number(body?.mao_de_obra);
    if (!Array.isArray(pecas) || !Number.isFinite(maoDeObra) || maoDeObra < 0) {
      return NextResponse.json({ error: "Informe as peças e a mão de obra corretamente." }, { status: 400 });
    }
    const pecasValidadas: PecaContraProposta[] = [];
    for (const p of pecas) {
      const vendaNova = Number(p?.vendaNova);
      if (!p?.posicao || !p?.codigo || !Number.isFinite(vendaNova) || vendaNova < 0) {
        return NextResponse.json({ error: "Valor inválido em uma das peças." }, { status: 400 });
      }
      pecasValidadas.push({
        posicao: String(p.posicao),
        codigo: String(p.codigo),
        custo: Number(p.custo) || 0,
        imposto: Number(p.imposto) || 0,
        vendaOriginal: Number(p.vendaOriginal) || 0,
        vendaNova,
      });
    }

    const { error } = await admin
      .from("orcamentos")
      .update({
        contra_proposta_pecas: pecasValidadas,
        contra_proposta_mao_de_obra: maoDeObra,
        contra_proposta_ajustado: true,
        contra_proposta_ajustado_por: user.id,
        contra_proposta_ajustado_em: agora,
        contra_proposta_decisao: "Aprovado",
        contra_proposta_motivo_recusa: null,
        contra_proposta_decidido_por: user.id,
        contra_proposta_decidido_em: agora,
      })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Reprovado — exige motivo, não mexe em contra_proposta_pecas/mao_de_obra.
  const motivo = String(body?.motivo ?? "").trim();
  if (!motivo) {
    return NextResponse.json({ error: "Informe o motivo da recusa." }, { status: 400 });
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      contra_proposta_decisao: "Reprovado",
      contra_proposta_motivo_recusa: motivo,
      contra_proposta_decidido_por: user.id,
      contra_proposta_decidido_em: agora,
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
