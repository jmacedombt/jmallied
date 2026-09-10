import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  podeConfirmarAprovacaoOrcamento,
  STATUS_AG_RESPOSTA_ORCAMENTO,
  STATUS_AG_CONTRA_PROPOSTA,
  STATUS_AG_PECAS,
  STATUS_ORCAMENTO_REPROVADO,
} from "@/lib/orcamentos";

export const maxDuration = 30;

// Botão "Confirmar" de "3 - Ag. Resposta de Orçamento" — pega todo
// aparelho dessa etapa que já tem um resultado de aprovação definido
// (Upload aprovação de orçamentos) e move cada um pro destino certo:
//   Aprovado         -> "5 - Ag. Peças"
//   Reprovado         -> "8 - Orçamento Reprovado" (mesmos campos que a
//                        reprovação manual já usa: motivo/quem/quando)
//   Contra Proposta   -> "Ag. Contra Proposta" (nova etapa, edição peça a
//                        peça antes de reenviar)
// Aparelho ainda "Aguardando" (sem upload casado) não é tocado. Não é
// por lote (NF Remessa) — age em todos os resolvidos de uma vez, porque
// o arquivo de resposta da Allied normalmente mistura vários lotes.
export async function POST() {
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
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para confirmar o resultado de aprovação." },
      { status: 403 }
    );
  }

  const agora = new Date().toISOString();

  const { data: aprovados, error: erroAprovados } = await admin
    .from("orcamentos")
    .update({ status_operacional: STATUS_AG_PECAS })
    .eq("status_operacional", STATUS_AG_RESPOSTA_ORCAMENTO)
    .eq("resultado_aprovacao_allied", "Aprovado")
    .select("id");

  if (erroAprovados) {
    return NextResponse.json({ error: erroAprovados.message }, { status: 400 });
  }

  const { data: reprovados, error: erroReprovados } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_ORCAMENTO_REPROVADO,
      motivo_reprova: "Reprovado pela Allied (resposta de orçamento)",
      reprovado_por: user.id,
      reprovado_em: agora,
    })
    .eq("status_operacional", STATUS_AG_RESPOSTA_ORCAMENTO)
    .eq("resultado_aprovacao_allied", "Reprovado")
    .select("id");

  if (erroReprovados) {
    return NextResponse.json({ error: erroReprovados.message }, { status: 400 });
  }

  const { data: contraProposta, error: erroContraProposta } = await admin
    .from("orcamentos")
    .update({ status_operacional: STATUS_AG_CONTRA_PROPOSTA })
    .eq("status_operacional", STATUS_AG_RESPOSTA_ORCAMENTO)
    .eq("resultado_aprovacao_allied", "Contra Proposta")
    .select("id");

  if (erroContraProposta) {
    return NextResponse.json({ error: erroContraProposta.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    aprovados: aprovados?.length ?? 0,
    reprovados: reprovados?.length ?? 0,
    contraProposta: contraProposta?.length ?? 0,
  });
}
