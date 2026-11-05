import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

// Alterar a VENDA peça por peça em Validação de Orçamentos (pedido
// explícito, 05/11/2026 — migration 0082). Corpo:
//   { pecas: { "<posição>": <venda>, ... }, justificativa: "..." }
//   { reverter: true }  → volta tudo pro cálculo automático
// Justificativa obrigatória (uma por orçamento). Mesmo cargo do "Ajustar
// valores" (Supervisor/Gerente/Administrador). Salvar zera o ajuste dos
// totais (migration 0021) desse aparelho, pra os dois não brigarem.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra alterar esses valores." }, { status: 403 });
  }

  const { data: atual } = await admin.from("orcamentos").select("status_operacional").eq("id", params.id).single();
  if (!atual) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  if (atual.status_operacional !== STATUS_VALIDACAO_ORCAMENTOS) {
    return NextResponse.json(
      { error: "Esse orçamento não está mais em Validação de Orçamentos — atualize a tela." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);

  if (body?.reverter === true) {
    const { error } = await admin
      .from("orcamentos")
      .update({
        validacao_pecas_venda_manual: null,
        validacao_pecas_justificativa: null,
        validacao_pecas_ajustado_por: null,
        validacao_pecas_ajustado_em: null,
      })
      .eq("id", params.id)
      .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const justificativa = String(body?.justificativa ?? "").trim();
  if (justificativa.length < 3) {
    return NextResponse.json({ error: "Escreva a justificativa da alteração." }, { status: 400 });
  }

  const entrada = body?.pecas && typeof body.pecas === "object" ? (body.pecas as Record<string, unknown>) : null;
  const pecas: Record<string, number> = {};
  for (const [posicao, valor] of Object.entries(entrada ?? {})) {
    const n = Number(valor);
    if (!/^(\d{1,2}|Extra [1-5])$/.test(posicao) || !Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: `Valor inválido na peça ${posicao}.` }, { status: 400 });
    }
    pecas[posicao] = Math.round(n * 100) / 100;
  }
  if (Object.keys(pecas).length === 0) {
    return NextResponse.json({ error: "Nenhuma peça alterada." }, { status: 400 });
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      validacao_pecas_venda_manual: pecas,
      validacao_pecas_justificativa: justificativa,
      validacao_pecas_ajustado_por: user.id,
      validacao_pecas_ajustado_em: new Date().toISOString(),
      // zera o ajuste dos totais — os totais passam a ser a soma das peças
      validacao_ajustado_manualmente: false,
      validacao_venda_manual: null,
      validacao_custo_manual: null,
      validacao_imposto_manual: null,
      validacao_mao_de_obra_manual: null,
      validacao_ajustado_por: null,
      validacao_ajustado_em: null,
    })
    .eq("id", params.id)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
